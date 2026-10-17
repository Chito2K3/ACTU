/**
 * Amang Rodriguez Memorial Medical Center (ARMMC)
 * Ambulatory Cancer Treatment Unit (ACTU) - Web App Backend
 * Google Apps Script (Code.gs)
 *
 * Core Architecture:
 * - Direct Patient-Centric CRUD against Master_Patients
 * - Automatic Last Visit date recording
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
 * - Patient records from Master_Patients
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
 */
function ensureRequiredSheets(ss) {
  let masterSheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (!masterSheet) {
    masterSheet = ss.insertSheet(CONFIG.MASTER_PATIENT_SHEET);
    masterSheet.appendRow(['Patient Name', 'Diagnosis', 'Protocol', 'Dosage', 'Last Visit', 'Created Date']);
    masterSheet.getRange(1, 1, 1, 6).setBackground(CONFIG.COLORS.HEADER_BLUE).setFontColor('#FFFFFF').setFontWeight('bold');
    masterSheet.setFrozenRows(1);
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
// MASTER PATIENTS CRUD
// ==========================================

/**
 * Dynamically resolves column indices in Master_Patients to accommodate
 * existing sheets whether 'Hospital Number' is present or not.
 */
function getMasterPatientColumnMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 7)).getValues()[0];
  const map = {
    nameCol: -1,
    diagCol: -1,
    protoCol: -1,
    dosageCol: -1,
    lastVisitCol: -1,
    createdCol: -1,
    hospCol: -1
  };

  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').toUpperCase().trim();
    if (h.includes('PATIENT NAME') || h === 'NAME') map.nameCol = c;
    else if (h.includes('DIAGNOSIS')) map.diagCol = c;
    else if (h.includes('PROTOCOL')) map.protoCol = c;
    else if (h.includes('DOSAGE')) map.dosageCol = c;
    else if (h.includes('LAST VISIT') || h === 'VISIT') map.lastVisitCol = c;
    else if (h.includes('CREATED')) map.createdCol = c;
    else if (h.includes('HOSPITAL')) map.hospCol = c;
  }

  // Fallbacks if headers were generic
  if (map.nameCol === -1) map.nameCol = 0;
  if (map.diagCol === -1) map.diagCol = 1;
  if (map.protoCol === -1) map.protoCol = 2;
  if (map.dosageCol === -1) map.dosageCol = 3;
  if (map.lastVisitCol === -1) map.lastVisitCol = 4;
  if (map.createdCol === -1) map.createdCol = 5;

  return map;
}

/**
 * Retrieves all patients from Master_Patients.
 */
function getPatientsList() {
  const ss = getSpreadsheet();
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

    const diag = String(row[colMap.diagCol] || '').trim();
    const proto = String(row[colMap.protoCol] || '').trim();
    const dosage = String(row[colMap.dosageCol] || '').trim();
    
    // Format Last Visit cleanly
    let lastVisit = row[colMap.lastVisitCol];
    let lastVisitStr = '';
    if (lastVisit instanceof Date && !isNaN(lastVisit.getTime())) {
      lastVisitStr = Utilities.formatDate(lastVisit, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      lastVisitStr = String(lastVisit || '').trim();
    }

    patients.push({
      rowIndex: i + 2, // 1-indexed sheet row
      name: name,
      diagnosis: diag,
      protocol: proto,
      dosage: dosage,
      lastVisit: lastVisitStr
    });
  }

  // Sort by most recent visit or alphabetically
  return patients;
}

/**
 * Saves (appends or updates) a patient record in Master_Patients.
 * Automatically stamps Last Visit with today's date.
 */
function savePatientRecord(payload) {
  if (!payload || !payload.name) {
    throw new Error('Patient name is required.');
  }

  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);
  const sheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  const colMap = getMasterPatientColumnMap(sheet);
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const targetName = payload.name.trim();
  const diagnosis = (payload.diagnosis || '').trim();
  const protocol = (payload.protocol || '').trim();
  const dosage = (payload.dosage || '').trim();

  let targetRow = parseInt(payload.rowIndex, 10);

  // If no explicit rowIndex passed, check if patient name already exists to update
  if (!targetRow || isNaN(targetRow)) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const names = sheet.getRange(2, colMap.nameCol + 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < names.length; i++) {
        if (String(names[i][0] || '').trim().toLowerCase() === targetName.toLowerCase()) {
          targetRow = i + 2;
          break;
        }
      }
    }
  }

  if (targetRow && targetRow >= 2) {
    // Update existing row
    sheet.getRange(targetRow, colMap.nameCol + 1).setValue(targetName);
    if (colMap.diagCol >= 0) sheet.getRange(targetRow, colMap.diagCol + 1).setValue(diagnosis);
    if (colMap.protoCol >= 0) sheet.getRange(targetRow, colMap.protoCol + 1).setValue(protocol);
    if (colMap.dosageCol >= 0) sheet.getRange(targetRow, colMap.dosageCol + 1).setValue(dosage);
    if (colMap.lastVisitCol >= 0) sheet.getRange(targetRow, colMap.lastVisitCol + 1).setValue(todayStr);

    return {
      success: true,
      message: 'Patient record for "' + targetName + '" updated successfully.',
      rowIndex: targetRow
    };
  }

  // Append new row
  const maxCols = Math.max(sheet.getLastColumn(), 6);
  const newRow = new Array(maxCols).fill('');
  newRow[colMap.nameCol] = targetName;
  if (colMap.diagCol >= 0) newRow[colMap.diagCol] = diagnosis;
  if (colMap.protoCol >= 0) newRow[colMap.protoCol] = protocol;
  if (colMap.dosageCol >= 0) newRow[colMap.dosageCol] = dosage;
  if (colMap.lastVisitCol >= 0) newRow[colMap.lastVisitCol] = todayStr;
  if (colMap.createdCol >= 0) newRow[colMap.createdCol] = todayStr;

  sheet.appendRow(newRow);

  return {
    success: true,
    message: 'New patient "' + targetName + '" registered successfully.',
    rowIndex: sheet.getLastRow()
  };
}

/**
 * Deletes a patient row from Master_Patients.
 */
function deletePatientRecord(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.MASTER_PATIENT_SHEET);
  if (!sheet) throw new Error('Master_Patients sheet not found.');

  const targetRow = parseInt(payload.rowIndex, 10);
  if (!targetRow || targetRow < 2 || targetRow > sheet.getLastRow()) {
    throw new Error('Invalid row index: ' + targetRow);
  }

  sheet.deleteRow(targetRow);
  return { success: true, message: 'Patient removed from records.' };
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
          message: 'Medicine already exists in repository.'
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
    message: 'Medicine "' + cleanName + '" added to repository successfully.'
  };
}

// ==========================================
// SPREADSHEET TAB CLEANUP UTILITY
// ==========================================

/**
 * Maintains ONLY Master_Patients and Medicine tabs,
 * removing all extraneous weekly schedule tabs (SEP 28-OCT 2, Copy of OCT 5-9, etc.)
 */
function cleanupSpreadsheetTabs() {
  const ss = getSpreadsheet();
  ensureRequiredSheets(ss);
  const sheets = ss.getSheets();
  const deletedTabs = [];

  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (name !== CONFIG.MASTER_PATIENT_SHEET && name !== CONFIG.MEDICINE_SHEET) {
      deletedTabs.push(name);
      ss.deleteSheet(sheet);
    }
  });

  return {
    success: true,
    deletedCount: deletedTabs.length,
    deletedTabs: deletedTabs,
    message: 'Cleanup complete. Retained only Master_Patients and Medicine tabs.'
  };
}
