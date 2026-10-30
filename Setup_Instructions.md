# Amang Rodriguez Memorial Medical Center (ARMMC)
## Pharmacy Chemotherapy Compounding Log - Web App Deployment Guide

This guide details the streamlined setup and deployment of the **ARMMC Pharmacy Chemotherapy Compounding Log** in your Google Spreadsheet.

---

## 1. System Overview

* **Institution Title**: **Amang Rodriguez Memorial Medical Center**
* **Application Title**: Pharmacy Chemotherapy Compounding Log
* **Spreadsheet Tabs Maintained**: Only **2 tabs**:
  1. **`Master_Patients`**: The clinical database storing `Patient Name`, `Diagnosis`, `Therapy Schedule`, `Chemo Protocol`, `Brand Name`, `Targeted Therapy`, `Lot Number`, `Expiry Date`, `Dosage`, `Quantity Required`, `Funding Source`, `Created Date`, and `Last Visit`.
  2. **`Medicine`**: The formulary source listing all available medicines (DMR Codes & unique descriptions).
* **Key Features**:
  * **Search by Patient Name & Schedule Pop-up**: Typing a patient name pops up all recorded Chemo Therapy Schedule dates for that patient. Clicking any date instantaneously populates the complete session details into the form.
  * **New Schedule Entry Option**: Clicking `+ Add New Schedule Entry` lets clinicians schedule a new treatment date via date picker while retaining patient baseline information.
  * **Separated Dosage & Quantity**: Clinical dosage (e.g., `440 mg`, `1.3 mg/m²`) and physical quantity required (e.g., `2 Vials`, `1 Box`) are maintained in separate dedicated columns and form inputs.
  * **Single-Checkbox Funding / Source Classification**: Dedicated single-selection checkbox for **`CAF`**, **`CSPMAP`**, or **`Outside Purchase`** stored in the `Funding Source` column for reporting and filtering.
  * **Targeted Therapy Checkbox & Report Filter**: Dedicated **`Targeted Therapy`** checkbox positioned directly below **Brand Name**, saved to the `Targeted Therapy` column in `Master_Patients`, with a **`🎯 Targeted Therapy`** filter pill in the table header for report building.
  * **Printable & Save-as-PDF Report Builder**: Built-in **`🖨️ Print Report`** modal supporting filtering by **Patient Name**, **Funding Source**, **Targeted Therapy**, **Per Medicine Compounded**, and **Date Range**, formatted with the official 3-column ARMMC Pharmacy signatory block (`Prepared By`, `Verified & Approved By`, `Acknowledged By`) for direct printing and PDF saving.
  * **Batch Tracking**: Includes dedicated fields for **Lot Number** and **Expiry Date** (with date picker) for pharmacy quality control.
  * **Automatic Column Migration**: When the script runs, it automatically verifies your existing `Master_Patients` sheet and safely appends any missing columns without altering or overwriting existing rows.
  * **Non-Destructive Tab Safety**: All existing tabs in the spreadsheet are fully protected and preserved. The script only reads/writes to `Master_Patients` and `Medicine`.

---

## 2. Step-by-Step Deployment in Google Apps Script

### Step 1: Open Google Apps Script
1. Open your [Ambulatory Cancer Treatment Unit Google Sheet](https://docs.google.com/spreadsheets/d/1V4BClF3nbFdDkpkBItNRV6R_hm9F-SdL2WJd-qvFWaQ/edit?gid=911550117#gid=911550117).
2. In the top menu, click **Extensions** > **Apps Script**.

### Step 2: Paste the Backend Code (`Code.gs`)
1. Open the existing `Code.gs` in the left sidebar.
2. Select all and paste the updated content from **[`Code.gs`](file:///c:/Users/chito/OneDrive/Desktop/Chito/Jungleworks/HR%20files/Chito%20Lates/ACTU/Code.gs)**.
3. Save (<kbd>Ctrl</kbd> + <kbd>S</kbd>).

### Step 3: Paste the Frontend Code (`index.html`)
1. Open or create the `index.html` file in the left sidebar (click **+** > **HTML** and name it `index`).
2. Select all and paste the updated content from **[`index.html`](file:///c:/Users/chito/OneDrive/Desktop/Chito/Jungleworks/HR%20files/Chito%20Lates/ACTU/index.html)**.
3. Save (<kbd>Ctrl</kbd> + <kbd>S</kbd>).

### Step 4: Publish New Version
1. In the upper-right corner of Google Apps Script, click **Deploy** > **New deployment** (or **Manage deployments**).
2. Select **Web app**, set **Execute as: Me** and **Who has access: Anyone**.
3. Click **Deploy**.
4. Open your Web App URL.

---

## 3. Spreadsheet Registry Maintenance
In the top right header of the web app, click **`🧹 Clean Tabs`**.
The system will:
1. Safely remove obsolete legacy columns like `Hospital Number` from `Master_Patients`.
2. Auto-format all column headers in `Master_Patients` using official ARMMC navy styling (`#1C3D5A`).
3. **Preserve all other existing tabs in the spreadsheet completely untouched.**
