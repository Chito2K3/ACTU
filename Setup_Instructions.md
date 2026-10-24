# Amang Rodriguez Memorial Medical Center (ARMMC)
## Ambulatory Cancer Treatment Unit (ACTU) - Web App Deployment Guide

This guide details the streamlined setup and deployment of the **ARMMC ACTU Multi-Schedule Patient Treatment Registry** in your Google Spreadsheet.

---

## 1. System Overview

* **Institution Title**: **Amang Rodriguez Memorial Medical Center**
* **Department**: Ambulatory Cancer Treatment Unit (ACTU)
* **Spreadsheet Tabs Maintained**: Only **2 tabs**:
  1. **`Master_Patients`**: The clinical database storing `Patient Name`, `Diagnosis`, `Therapy Schedule`, `Chemo Protocol`, `Brand Name`, `Lot Number`, `Expiry Date`, `Dosage`, `Quantity Required`, `Created Date`, and `Last Visit`.
  2. **`Medicine`**: The formulary source listing all available medicines (DMR Codes & unique descriptions).
* **Key Features**:
  * **Search by Patient Name & Schedule Pop-up**: Typing a patient name pops up all recorded Chemo Therapy Schedule dates for that patient. Clicking any date instantaneously populates the complete session details into the form.
  * **New Schedule Entry Option**: Clicking `+ Add New Schedule Entry` lets clinicians schedule a new treatment date via date picker while retaining patient baseline information.
  * **Separated Dosage & Quantity**: Clinical dosage (e.g., `440 mg`, `1.3 mg/m²`) and physical quantity required (e.g., `2 Vials`, `1 Box`) are maintained in separate dedicated columns and form inputs.
  * **Batch Tracking**: Includes dedicated fields for **Lot Number** and **Expiry Date** (with date picker) for pharmacy quality control.
  * **Automatic Column Migration**: When the script runs, it automatically verifies your existing `Master_Patients` sheet and safely appends any missing columns without altering or overwriting existing rows.
  * **Tab Cleanup Utility**: Click the `🧹 Clean Tabs` button in the header to safely delete all obsolete weekly schedule tabs (`SEP 28-OCT 2`, `Copy of OCT 5-9`, etc.), keeping only `Master_Patients` and `Medicine`.

---

## 2. Step-by-Step Deployment in Google Apps Script

### Step 1: Open Google Apps Script
1. Open your [Ambulatory Cancer Treatment Unit Google Sheet](https://docs.google.com/spreadsheets/d/1ry9tud_1ZsuEiqZdMzaQ9a5e4_8ipTK70udu3vYJm48/edit?gid=683243237#gid=683243237).
2. In the top menu, click **Extensions** > **Apps Script**.

### Step 2: Paste the Backend Code (`Code.gs`)
1. Open the existing `Code.gs` in the left sidebar.
2. Select all and paste the updated content from **[`Code.gs`](file:///c:/Users/chito/OneDrive/Desktop/Chito/Jungleworks/HR%20files/Chito%20Lates/ACTU/Code.gs)**.
3. Save (<kbd>Ctrl</kbd> + <kbd>S</kbd>).

### Step 3: Paste the Frontend Code (`index.html`)
1. Open the existing `index.html` file in the left sidebar.
2. Select all and paste the updated content from **[`index.html`](file:///c:/Users/chito/OneDrive/Desktop/Chito/Jungleworks/HR%20files/Chito%20Lates/ACTU/index.html)**.
3. Save (<kbd>Ctrl</kbd> + <kbd>S</kbd>).

### Step 4: Publish New Version
1. In the upper-right corner of Google Apps Script, click **Deploy** > **Manage deployments**.
2. Click the **Pencil (Edit)** icon on your active Web App deployment.
3. In the **Version** dropdown, select **New version**.
4. Click **Deploy**.
5. Open your Web App URL.

---

## 3. How to Clean Up the Google Sheet Tabs & Obsolete Columns
In the top right header of the web app, click **`🧹 Clean Tabs`**.
The system will automatically:
1. Remove all obsolete weekly tabs (`SEP 28-OCT 2`, `Copy of OCT...`), leaving exclusively `Master_Patients` and `Medicine`.
2. Permanently delete legacy obsolete columns like `Hospital Number` from `Master_Patients`.
3. Auto-format all column headers in `Master_Patients` using official ARMMC navy styling (`#1C3D5A`).
