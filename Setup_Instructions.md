# Amang Rodriguez Memorial Medical Center (ARMMC)
## Ambulatory Cancer Treatment Unit (ACTU) - Web App Deployment Guide

This guide details the streamlined setup and deployment of the **ARMMC ACTU Patient Treatment Registry** in your Google Spreadsheet.

---

## 1. System Overview

* **Institution Title**: **Amang Rodriguez Memorial Medical Center**
* **Department**: Ambulatory Cancer Treatment Unit (ACTU)
* **Spreadsheet Tabs Maintained**: Only **2 tabs**:
  1. **`Master_Patients`**: The primary database storing Patient Name, Diagnosis, Protocol, Brand Name, Dosage, and Last Visit date.
  2. **`Medicine`**: The formulary source listing all available medicines.
* **Key Features**:
  * **Direct Patient CRUD**: Add, edit, or delete patient records directly in `Master_Patients`.
  * **Auto Last Visit Recording**: Every time a patient's treatment is registered or updated, the current date is auto-stamped into `Last Visit`.
  * **Unique Medicine Dropdown (No DMR Codes)**: Deduplicated medicine names with clean search and selection.
  * **On-the-Fly Medicine Addition**: If a medicine is not found in the list, click `+ Add to Database` directly from the dropdown or the Medicine Repository modal to append it to the `Medicine` tab instantly!
  * **Tab Cleanup Utility**: Click the `🧹 Clean Tabs` button in the header to safely delete all obsolete weekly schedule tabs (`SEP 28-OCT 2`, `Copy of OCT 5-9`, etc.), keeping only `Master_Patients` and `Medicine`.

---

## 2. Step-by-Step Deployment in Google Apps Script

### Step 1: Open Google Apps Script
1. Open your [Ambulatory Cancer Treatment Unit Google Sheet](https://docs.google.com/spreadsheets/d/1ry9tud_1ZsuEiqZdMzaQ9a5e4_8ipTK70udu3vYJm48/edit).
2. In the top menu, click **Extensions** > **Apps Script**.

### Step 2: Paste the Backend Code (`Code.gs`)
1. Open the existing `Code.gs` in the left sidebar.
2. Select all and paste the updated content from **[`Code.gs`](file:///c:/Users/chito/OneDrive/Desktop/Chito/Jungleworks/HR%20files/Chito%20Lates/ACTU/Code.gs)**.
3. Save (Ctrl + S).

### Step 3: Paste the Frontend Code (`index.html`)
1. Open the existing `index.html` file in the left sidebar.
2. Select all and paste the updated content from **[`index.html`](file:///c:/Users/chito/OneDrive/Desktop/Chito/Jungleworks/HR%20files/Chito%20Lates/ACTU/index.html)**.
3. Save (Ctrl + S).

### Step 4: Publish New Version
1. In the upper-right corner, click **Deploy** > **Manage deployments**.
2. Click the **Pencil (Edit)** icon on your active Web App deployment.
3. In the **Version** dropdown, select **New version**.
4. Click **Deploy**.
5. Open your Web App URL.

---

## 3. How to Clean Up the Google Sheet Tabs & Obsolete Columns
In the top right header of the web app, click **`🧹 Clean Tabs`**.
The system will automatically:
1. Remove all obsolete weekly tabs (`SEP 28-OCT 2`, `Copy of OCT...`), leaving exclusively `Master_Patients` and `Medicine`.
2. Permanently delete the obsolete **`Hospital Number`** column from `Master_Patients`, cleanly shifting `Patient Name` into Column A.
