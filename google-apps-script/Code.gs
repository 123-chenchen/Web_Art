const ADMIN_EMAIL = 'admin@example.com';
const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'Orders';
const MAX_IMAGES = 20;

const HEADER_ROW = [
  'Thời gian đặt',
  'Họ tên',
  'SĐT',
  'Địa chỉ',
  'Số ảnh',
  'Combo chọn',
  'Tổng tiền',
  'Ghi chú',
  'Link ảnh 1',
  'Link ảnh 2',
  'Link ảnh 3',
  'Link ảnh 4',
  'Link ảnh 5',
  'Link ảnh 6',
  'Link ảnh 7',
  'Link ảnh 8',
  'Link ảnh 9',
  'Link ảnh 10',
  'Link ảnh 11',
  'Link ảnh 12',
  'Link ảnh 13',
  'Link ảnh 14',
  'Link ảnh 15',
  'Link ảnh 16',
  'Link ảnh 17',
  'Link ảnh 18',
  'Link ảnh 19',
  'Link ảnh 20',
  'Trạng thái đơn',
];

const PRICE_TABLE = [
  { size: 1, price: 99000, label: 'Tấm lẻ' },
  { size: 3, price: 290000, label: 'Combo 3 tấm' },
  { size: 5, price: 465000, label: 'Combo 5 tấm' },
  { size: 9, price: 810000, label: 'Combo 9 tấm' },
  { size: 10, price: 900000, label: 'Combo 10 tấm' },
  { size: 15, price: 1350000, label: 'Combo 15 tấm' },
  { size: 20, price: 1800000, label: 'Combo 20 tấm' },
];

function doGet() {
  return jsonResponse_({
    ok: true,
    message: 'Hexagon order endpoint is ready.',
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const rawBody = e && e.postData && e.postData.contents;

    if (!rawBody) {
      throw new Error('Thiếu nội dung đơn hàng.');
    }

    const payload = JSON.parse(rawBody);
    const order = validateOrder_(payload);
    const spreadsheet = getSpreadsheet_();
    const sheet = getSheet_(spreadsheet);
    ensureHeader_(sheet);

    const imageCells = Array(MAX_IMAGES).fill('');
    order.imageUrls.forEach(function (url, index) {
      imageCells[index] = url;
    });

    sheet.appendRow([
      new Date(),
      order.name,
      order.phone,
      order.address,
      order.imageCount,
      order.combo,
      order.total,
      order.note,
    ].concat(imageCells, ['Mới']));

    sendAdminEmail_(order, spreadsheet.getUrl());

    return jsonResponse_({
      ok: true,
      message: 'Order saved.',
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      message: error && error.message ? error.message : 'Không xử lý được đơn hàng.',
    });
  } finally {
    lock.releaseLock();
  }
}

function validateOrder_(payload) {
  if (payload.website) {
    throw new Error('Spam detected.');
  }

  const name = cleanText_(payload.name, 120);
  const phone = cleanText_(payload.phone, 30);
  const address = cleanText_(payload.address, 500);
  const note = cleanText_(payload.note || '', 1000);
  const combo = cleanText_(payload.combo, 160);
  const total = Number(payload.total);
  const imageUrls = Array.isArray(payload.imageUrls) ? payload.imageUrls : [];
  const imageCount = Number(payload.imageCount || imageUrls.length);

  if (!name) throw new Error('Thiếu họ tên.');
  if (!/^[0-9+\s().-]{8,16}$/.test(phone)) throw new Error('SĐT chưa hợp lệ.');
  if (!address) throw new Error('Thiếu địa chỉ nhận hàng.');
  if (!combo) throw new Error('Thiếu combo.');
  if (!Number.isInteger(imageCount) || imageCount < 1 || imageCount > MAX_IMAGES) {
    throw new Error('Số ảnh không hợp lệ.');
  }
  if (imageUrls.length !== imageCount) {
    throw new Error('Số link ảnh không khớp số ảnh.');
  }
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Tổng tiền không hợp lệ.');
  }

  const expectedTotal = calculateBestPrice_(imageCount);
  if (total !== expectedTotal) {
    throw new Error('Tổng tiền không khớp bảng giá.');
  }

  imageUrls.forEach(function (url, index) {
    if (!isValidCloudinaryImageUrl_(url)) {
      throw new Error('Link ảnh ' + (index + 1) + ' không hợp lệ.');
    }
  });

  return {
    name: name,
    phone: phone,
    address: address,
    note: note,
    imageCount: imageCount,
    combo: combo,
    total: total,
    imageUrls: imageUrls,
  };
}

function calculateBestPrice_(imageCount) {
  const dp = Array(imageCount + 1).fill(null);
  dp[0] = 0;

  for (let count = 1; count <= imageCount; count += 1) {
    PRICE_TABLE.forEach(function (option) {
      if (count < option.size || dp[count - option.size] === null) return;

      const candidate = dp[count - option.size] + option.price;
      if (dp[count] === null || candidate < dp[count]) {
        dp[count] = candidate;
      }
    });
  }

  return dp[imageCount] || imageCount * 99000;
}

function cleanText_(value, maxLength) {
  return String(value || '')
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, maxLength);
}

function isValidCloudinaryImageUrl_(url) {
  const value = String(url || '').trim();
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(value);
}

function normalizeSpreadsheetId_(value) {
  const input = String(value || '').trim();
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

  return match ? match[1] : input;
}

function getSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PASTE_GOOGLE_SHEET_ID_HERE') {
    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!activeSpreadsheet) {
      throw new Error('Cần điền SPREADSHEET_ID trong Apps Script.');
    }
    return activeSpreadsheet;
  }

  return SpreadsheetApp.openById(normalizeSpreadsheetId_(SPREADSHEET_ID));
}

function getSheet_(spreadsheet) {
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeader_(sheet) {
  const currentHeader = sheet.getRange(1, 1, 1, HEADER_ROW.length).getValues()[0];
  const hasHeader = currentHeader.some(function (cell) {
    return String(cell || '').trim();
  });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
    sheet.setFrozenRows(1);
  }
}

function sendAdminEmail_(order, sheetUrl) {
  const imageListHtml = order.imageUrls
    .map(function (url, index) {
      return '<li><a href="' + escapeHtml_(url) + '">Link ảnh ' + (index + 1) + '</a></li>';
    })
    .join('');
  const imageListText = order.imageUrls
    .map(function (url, index) {
      return 'Link ảnh ' + (index + 1) + ': ' + url;
    })
    .join('\n');
  const subject = 'Có đơn tranh lục giác mới - ' + order.name;
  const body =
    'Có đơn tranh lục giác mới\n\n' +
    'Tên khách: ' + order.name + '\n' +
    'SĐT: ' + order.phone + '\n' +
    'Địa chỉ: ' + order.address + '\n' +
    'Số ảnh: ' + order.imageCount + '\n' +
    'Combo: ' + order.combo + '\n' +
    'Tổng tiền: ' + formatMoney_(order.total) + '\n' +
    'Link Google Sheet: ' + sheetUrl + '\n\n' +
    'Danh sách link ảnh khách upload:\n' + imageListText;
  const htmlBody =
    '<h2>Có đơn tranh lục giác mới</h2>' +
    '<p><strong>Tên khách:</strong> ' + escapeHtml_(order.name) + '</p>' +
    '<p><strong>SĐT:</strong> ' + escapeHtml_(order.phone) + '</p>' +
    '<p><strong>Địa chỉ:</strong> ' + escapeHtml_(order.address) + '</p>' +
    '<p><strong>Số ảnh:</strong> ' + order.imageCount + '</p>' +
    '<p><strong>Combo:</strong> ' + escapeHtml_(order.combo) + '</p>' +
    '<p><strong>Tổng tiền:</strong> ' + formatMoney_(order.total) + '</p>' +
    '<p><strong>Link Google Sheet:</strong> <a href="' + escapeHtml_(sheetUrl) + '">Mở sheet</a></p>' +
    '<p><strong>Danh sách link ảnh khách upload:</strong></p>' +
    '<ol>' + imageListHtml + '</ol>';

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
  });
}

function formatMoney_(value) {
  return Number(value).toLocaleString('vi-VN') + 'đ';
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
