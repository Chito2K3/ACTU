/**
 * Amang Rodriguez Memorial Medical Center (ARMMC)
 * Ambulatory Cancer Treatment Unit (ACTU) - Web App Backend
 * Google Apps Script (Code.gs)
 *
 * Core Architecture:
 * - Direct Patient-Centric CRUD against Master_Patients
 * - Multi-Schedule Chemo Therapy Tracking per Patient
 * - Automatic Last Visit date recording
 * - Comprehensive Clinical Batch Tracking (Lot Number & Expiry Date)
 * - Separated Clinical Dosage and Quantity Required
 * - Unique Medicine Formulary Engine (Deduplicated, pure medicine names without DMR codes)
 * - On-the-Fly Medicine Addition to the Medicine repository
 * - Automated Spreadsheet Tab Cleanup (Retaining ONLY Master_Patients and Medicine)
 */

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================

const CONFIG = {
  INSTITUTION_NAME: 'Amang Rodriguez Memorial Medical Center',
  UNIT_NAME: 'Ambulatory Cancer Treatment Unit (ACTU)',
  MASTER_PATIENT_SHEET: 'Master_Patients',
  MEDICINE_SHEET: 'Medicine',
  COLORS: {
    HEADER_BLUE: '#1C3D5A',
    HEADER_ORANGE: '#D97706',
    WHITE: '#FFFFFF',
    LIGHT_GRAY: '#F8FAFC'
  }
};

/**
 * Serves the Web App frontend (index.html)
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Amang Rodriguez Memorial Medical Center - ACTU')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Returns the active spreadsheet instance.
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ==========================================
// INITIALIZATION & DIRECT DATA APIS
// ==========================================

/**
 * Loads all initial application state:
 * - Patient session records from Master_Patients
 * - Unique deduplicated medicines from Medicine
 */
function getInitialData() {
  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);

  const patients = getPatientsList();
  const uniqueMedicines = getUniqueMedicineList();

  return {
    institution: CONFIG.INSTITUTION_NAME,
    unit: CONFIG.UNIT_NAME,
    patients: patients,
    medicines: uniqueMedicines // Array of unique medicine strings (no DMR codes)
  };
}

/**
 * Ensures Master_Patients and Medicine sheets exist with proper headers.
 * Seamlessly adds missing clinical columns without altering or losing existing rows.
 */
function ensureRequiredSheets(ss) {
  let masterSheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (!masterSheet) {
    masterSheet = ss.insertSheet(CONFIG.MASTER_PATIENT_SHEET);
    masterSheet.appendRow([
      'Patient Name',
      'Diagnosis',
      'Therapy Schedule',
      'Chemo Protocol',
      'Brand Name',
      'Lot Number',
      'Expiry Date',
      'Dosage',
      'Quantity Required',
      'Created Date',
      'Last Visit'
    ]);
    masterSheet.getRange(1, 1, 1, 11).setBackground(CONFIG.COLORS.HEADER_BLUE).setFontColor('#FFFFFF').setFontWeight('bold');
    masterSheet.setFrozenRows(1);
  } else {
    // If sheet exists, ensure all required columns are present
    const lastCol = masterSheet.getLastColumn();
    if (lastCol > 0) {
      const headers = masterSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
        return String(h || '').toUpperCase().trim();
      });
      const missingHeaders = [];

      if (!headers.some(function(h) { return h.includes('SCHEDULE'); })) missingHeaders.push('Therapy Schedule');
      if (!headers.some(function(h) { return h.includes('BRAND'); })) missingHeaders.push('Brand Name');
      if (!headers.some(function(h) { return h.includes('LOT'); })) missingHeaders.push('Lot Number');
      if (!headers.some(function(h) { return h.includes('EXPIR'); })) missingHeaders.push('Expiry Date');
      if (!headers.some(function(h) { return h.includes('QUANTITY') || h === 'QTY'; })) missingHeaders.push('Quantity Required');

      if (missingHeaders.length > 0) {
        const currentLast = masterSheet.getLastColumn();
        for (let i = 0; i < missingHeaders.length; i++) {
          const colIdx = currentLast + 1 + i;
          masterSheet.getRange(1, colIdx)
            .setValue(missingHeaders[i])
            .setBackground(CONFIG.COLORS.HEADER_BLUE)
            .setFontColor('#FFFFFF')
            .setFontWeight('bold');
        }
      }
    }
  }

  let medSheet = ss.getSheetByName(CONFIG.MEDICINE_SHEET);
  if (!medSheet) {
    medSheet = ss.insertSheet(CONFIG.MEDICINE_SHEET);
    medSheet.appendRow(['Code', 'Medicine']);
    medSheet.getRange(1, 1, 1, 2).setBackground(CONFIG.COLORS.HEADER_ORANGE).setFontColor('#FFFFFF').setFontWeight('bold');
    medSheet.setFrozenRows(1);
  }
}

// ==========================================
// MASTER PATIENTS CRUD & MULTI-SCHEDULE ENGINE
// ==========================================

/**
 * Dynamically resolves column indices in Master_Patients to accommodate
 * existing sheets whether headers are 'Last Protocol', 'Last Dosage', etc.
 */
function getMasterPatientColumnMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const maxCols = Math.min(Math.max(lastCol, 15), sheet.getMaxColumns());
  const headers = maxCols > 0 ? sheet.getRange(1, 1, 1, maxCols).getValues()[0] : [];
  const map = {
    nameCol: -1,
    diagCol: -1,
    schedCol: -1,
    protoCol: -1,
    brandCol: -1,
    lotCol: -1,
    expiryCol: -1,
    dosageCol: -1,
    qtyCol: -1,
    lastVisitCol: -1,
    createdCol: -1,
    hospCol: -1
  };

  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').toUpperCase().trim();
    if (h.includes('PATIENT NAME') || h === 'NAME') map.nameCol = c;
    else if (h.includes('DIAGNOSIS')) map.diagCol = c;
    else if (h.includes('SCHEDULE') || h.includes('THERAPY SCHEDULE')) map.schedCol = c;
    else if (h.includes('PROTOCOL')) map.protoCol = c;
    else if (h.includes('BRAND')) map.brandCol = c;
    else if (h.includes('LOT')) map.lotCol = c;
    else if (h.includes('EXPIR') || h.includes('EXPIRY')) map.expiryCol = c;
    else if (h.includes('QUANTITY') || h === 'QTY' || h.includes('QTY')) map.qtyCol = c;
    else if (h.includes('DOSAGE')) map.dosageCol = c;
    else if (h.includes('LAST VISIT') || h === 'VISIT') map.lastVisitCol = c;
    else if (h.includes('CREATED')) map.createdCol = c;
    else if (h.includes('HOSPITAL')) map.hospCol = c;
  }

  // Fallbacks if headers were generic or not yet labeled
  if (map.nameCol === -1) map.nameCol = map.hospCol === 0 ? 1 : 0;
  if (map.diagCol === -1) map.diagCol = map.nameCol + 1;
  if (map.protoCol === -1) map.protoCol = map.diagCol + 1;
  if (map.brandCol === -1) map.brandCol = map.protoCol + 1;
  if (map.dosageCol === -1) map.dosageCol = map.brandCol + 1;
  if (map.lastVisitCol === -1) map.lastVisitCol = map.dosageCol + 1;
  if (map.createdCol === -1) map.createdCol = map.lastVisitCol + 1;

  return map;
}

/**
 * Retrieves all patient treatment schedule records from Master_Patients.
 */
function getPatientsList() {
  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);
  const sheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const colMap = getMasterPatientColumnMap(sheet);
  const numCols = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  const patients = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const name = String(row[colMap.nameCol] || '').trim();
    if (!name) continue;

    const diag = colMap.diagCol >= 0 ? String(row[colMap.diagCol] || '').trim() : '';
    const proto = colMap.protoCol >= 0 ? String(row[colMap.protoCol] || '').trim() : '';
    const brand = colMap.brandCol >= 0 ? String(row[colMap.brandCol] || '').trim() : '';
    const lot = colMap.lotCol >= 0 ? String(row[colMap.lotCol] || '').trim() : '';
    const dosage = colMap.dosageCol >= 0 ? String(row[colMap.dosageCol] || '').trim() : '';
    const qty = colMap.qtyCol >= 0 ? String(row[colMap.qtyCol] || '').trim() : '';

    // Format dates cleanly YYYY-MM-DD
    let scheduleStr = '';
    if (colMap.schedCol >= 0) {
      const schedVal = row[colMap.schedCol];
      if (schedVal instanceof Date && !isNaN(schedVal.getTime())) {
        scheduleStr = Utilities.formatDate(schedVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        scheduleStr = String(schedVal || '').trim();
      }
    }

    let expiryStr = '';
    if (colMap.expiryCol >= 0) {
      const expVal = row[colMap.expiryCol];
      if (expVal instanceof Date && !isNaN(expVal.getTime())) {
        expiryStr = Utilities.formatDate(expVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        expiryStr = String(expVal || '').trim();
      }
    }

    let lastVisitStr = '';
    if (colMap.lastVisitCol >= 0) {
      const visitVal = row[colMap.lastVisitCol];
      if (visitVal instanceof Date && !isNaN(visitVal.getTime())) {
        lastVisitStr = Utilities.formatDate(visitVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        lastVisitStr = String(visitVal || '').trim();
      }
    }

    patients.push({
      rowIndex: i + 2, // 1-indexed sheet row
      name: name,
      diagnosis: diag,
      scheduleDate: scheduleStr || lastVisitStr, // Fallback to last visit date if schedule date was empty
      protocol: proto,
      brand: brand,
      lotNumber: lot,
      expiryDate: expiryStr,
      dosage: dosage,
      quantity: qty,
      lastVisit: lastVisitStr
    });
  }

  return patients;
}

/**
 * Saves (appends or updates) a patient treatment schedule record in Master_Patients.
 * Supports updating an existing session row or appending a new schedule date entry.
 */
function savePatientRecord(payload) {
  if (!payload || !payload.name || !payload.name.trim()) {
    throw new Error('Patient name is required.');
  }
  if (!payload.brand || !payload.brand.trim()) {
    throw new Error('Brand Name is required.');
  }

  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);
  const sheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  const colMap = getMasterPatientColumnMap(sheet);
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const targetName = payload.name.trim();
  const diagnosis = (payload.diagnosis || '').trim();
  const scheduleDate = (payload.scheduleDate || todayStr).trim();
  const protocol = (payload.protocol || '').trim();
  const brand = payload.brand.trim();
  const lotNumber = (payload.lotNumber || '').trim();
  const expiryDate = (payload.expiryDate || '').trim();
  const dosage = (payload.dosage || '').trim();
  const quantity = (payload.quantity || '').trim();

  let targetRow = parseInt(payload.rowIndex, 10);

  // If updating an existing session row
  if (targetRow && targetRow >= 2 && !payload.isNewScheduleEntry) {
    if (colMap.nameCol >= 0) sheet.getRange(targetRow, colMap.nameCol + 1).setValue(targetName);
    if (colMap.diagCol >= 0) sheet.getRange(targetRow, colMap.diagCol + 1).setValue(diagnosis);
    if (colMap.schedCol >= 0) sheet.getRange(targetRow, colMap.schedCol + 1).setValue(scheduleDate);
    if (colMap.protoCol >= 0) sheet.getRange(targetRow, colMap.protoCol + 1).setValue(protocol);
    if (colMap.brandCol >= 0) sheet.getRange(targetRow, colMap.brandCol + 1).setValue(brand);
    if (colMap.lotCol >= 0) sheet.getRange(targetRow, colMap.lotCol + 1).setValue(lotNumber);
    if (colMap.expiryCol >= 0) sheet.getRange(targetRow, colMap.expiryCol + 1).setValue(expiryDate);
    if (colMap.dosageCol >= 0) sheet.getRange(targetRow, colMap.dosageCol + 1).setValue(dosage);
    if (colMap.qtyCol >= 0) sheet.getRange(targetRow, colMap.qtyCol + 1).setValue(quantity);
    if (colMap.lastVisitCol >= 0) sheet.getRange(targetRow, colMap.lastVisitCol + 1).setValue(todayStr);

    return {
      success: true,
      message: 'Treatment schedule for "' + targetName + '" (' + scheduleDate + ') updated successfully.',
      rowIndex: targetRow
    };
  }

  // Otherwise, append a new row for this therapy schedule session
  const maxCols = Math.max(sheet.getLastColumn(), 11);
  const newRow = new Array(maxCols).fill('');
  if (colMap.nameCol >= 0) newRow[colMap.nameCol] = targetName;
  if (colMap.diagCol >= 0) newRow[colMap.diagCol] = diagnosis;
  if (colMap.schedCol >= 0) newRow[colMap.schedCol] = scheduleDate;
  if (colMap.protoCol >= 0) newRow[colMap.protoCol] = protocol;
  if (colMap.brandCol >= 0) newRow[colMap.brandCol] = brand;
  if (colMap.lotCol >= 0) newRow[colMap.lotCol] = lotNumber;
  if (colMap.expiryCol >= 0) newRow[colMap.expiryCol] = expiryDate;
  if (colMap.dosageCol >= 0) newRow[colMap.dosageCol] = dosage;
  if (colMap.qtyCol >= 0) newRow[colMap.qtyCol] = quantity;
  if (colMap.createdCol >= 0) newRow[colMap.createdCol] = todayStr;
  if (colMap.lastVisitCol >= 0) newRow[colMap.lastVisitCol] = todayStr;

  sheet.appendRow(newRow);

  return {
    success: true,
    message: 'New therapy schedule for "' + targetName + '" (' + scheduleDate + ') recorded successfully.',
    rowIndex: sheet.getLastRow()
  };
}

/**
 * Deletes a patient treatment schedule row from Master_Patients.
 */
function deletePatientRecord(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (!sheet) throw new Error('Patient registry sheet not found.');

  const targetRow = parseInt(payload.rowIndex, 10);
  if (!targetRow || targetRow < 2 || targetRow > sheet.getLastRow()) {
    throw new Error('Invalid record selected for deletion.');
  }

  sheet.deleteRow(targetRow);
  return { success: true, message: 'Treatment schedule record removed from clinical registry.' };
}

// ==========================================
// MEDICINE REPOSITORY (UNIQUE, NO CODES)
// ==========================================

/**
 * Retrieves all unique medicine names from Column B of the Medicine tab.
 * Deduplicates all names and excludes DMR Codes.
 */
function getUniqueMedicineList() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.MEDICINE_SHEET);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  const seen = new Set();
  const uniqueMeds = [];

  for (let i = 0; i < values.length; i++) {
    const rawName = String(values[i][0] || '').trim();
    if (!rawName) continue;

    const key = rawName.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMeds.push(rawName);
    }
  }

  uniqueMeds.sort(function(a, b) {
    return a.localeCompare(b);
  });

  return uniqueMeds;
}

/**
 * Adds a new medicine on the fly to the Medicine tab in Google Sheets.
 * Generates the next DMR code and appends the row.
 */
function addNewMedicine(medicineName) {
  if (!medicineName || !medicineName.trim()) {
    throw new Error('Medicine name cannot be empty.');
  }

  const cleanName = medicineName.trim();
  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);
  const sheet = ss.getSheetByName(CONFIG.MEDICINE_SHEET);

  // Check if it already exists (case-insensitive)
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < existing.length; i++) {
      if (String(existing[i][0] || '').trim().toLowerCase() === cleanName.toLowerCase()) {
        return {
          success: true,
          medicineName: String(existing[i][0]).trim(),
          alreadyExisted: true,
          message: 'Medicine already exists in the hospital formulary.'
        };
      }
    }
  }

  // Generate a new code: DMR + (lastRow)
  const nextNum = Math.max(lastRow, 1);
  const padded = ('000000' + nextNum).slice(-6);
  const newCode = 'DMR' + padded;

  sheet.appendRow([newCode, cleanName]);

  return {
    success: true,
    medicineName: cleanName,
    newCode: newCode,
    alreadyExisted: false,
    message: 'Medicine "' + cleanName + '" added to hospital formulary successfully.'
  };
}

// ==========================================
// SPREADSHEET TAB & COLUMN CLEANUP UTILITY
// ==========================================

/**
 * Maintains ONLY Master_Patients and Medicine tabs,
 * removes all extraneous weekly schedule tabs (SEP 28-OCT 2, Copy of OCT 5-9, etc.),
 * and removes obsolete columns like 'Hospital Number' from Master_Patients.
 */
function cleanupSpreadsheetTabs() {
  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);
  const sheets = ss.getSheets();
  const deletedTabs = [];

  // 1. Delete extraneous weekly tabs
  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (name !== CONFIG.MASTER_PATIENT_SHEET && name !== CONFIG.MEDICINE_SHEET) {
      deletedTabs.push(name);
      ss.deleteSheet(sheet);
    }
  });

  // 2. Remove 'Hospital Number' column(s) from Master_Patients
  let hospColRemoved = false;
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (masterSheet && masterSheet.getLastColumn() > 0) {
    const lastCol = masterSheet.getLastColumn();
    const headers = masterSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (let c = headers.length - 1; c >= 0; c--) {
      const h = String(headers[c] || '').toUpperCase().trim();
      if (h.includes('HOSPITAL')) {
        masterSheet.deleteColumn(c + 1);
        hospColRemoved = true;
      }
    }
  }

  let message = 'Cleanup complete. Retained only Master_Patients and Medicine tabs.';
  if (deletedTabs.length > 0 && hospColRemoved) {
    message = 'Cleanup complete! Removed ' + deletedTabs.length + ' obsolete tabs and deleted Hospital Number column.';
  } else if (hospColRemoved) {
    message = 'Cleanup complete! Hospital Number column successfully removed from Master_Patients.';
  } else if (deletedTabs.length > 0) {
    message = 'Cleanup complete! Removed ' + deletedTabs.length + ' obsolete tabs.';
  }

  return {
    success: true,
    deletedCount: deletedTabs.length,
    deletedTabs: deletedTabs,
    hospitalColumnRemoved: hospColRemoved,
    message: message
  };
}
