# Amang Rodriguez Memorial Medical Center (ARMMC)
## Ambulatory Cancer Treatment Unit (ACTU) - Web Application

A modern, responsive Google Apps Script Single-Page Application (SPA) designed for the Ambulatory Cancer Treatment Unit at Amang Rodriguez Memorial Medical Center.

---

## 🌟 Key Features

* **Multi-Schedule Patient Treatment Registry**:
  * Direct bidirectional connection to `Master_Patients` in Google Sheets.
  * Real-time search by Patient Name, Diagnosis, Therapy Schedule Date, Medicine Protocol, Brand Name, Lot Number, Expiry Date, Dosage, and Quantity.
  * **Therapy Schedule Timeline**: Searching or entering a patient name displays all of their recorded treatment dates. Clicking any schedule date instantly populates the complete session record.
  * **Add New Schedule Entry**: Add subsequent chemotherapy dates for returning patients without retyping baseline clinical diagnosis or brand data.

* **Dedicated Clinical Fields (Separated & Batch-Tracked)**:
  * **Dosage**: Prescribed clinical dosage (e.g. `440 mg`, `1.3 mg/m²`).
  * **Quantity Required**: Physical units needed for pharmacy dispensing (e.g. `2 Vials`, `1 Box`).
  * **Lot Number**: Manufacturer batch identification.
  * **Expiry Date**: Medication expiration date with interactive date picker.

* **Deduplicated Medicine Repository**:
  * Live searchable formulary with all duplicate medicine names removed.
  * Pure, clean medicine descriptions (DMR codes excluded from clinical view).
  * Auto-focuses the next field upon medicine selection.

* **On-the-Fly Medicine Addition**:
  * Ability to add unlisted medicines directly from the Chemo Protocol dropdown or the Medicine Repository browser into the `Medicine` tab in Google Sheets.

* **Automated Last Visit Tracking**:
  * Stamps the current date (`YYYY-MM-DD`) on every patient treatment registration or session update.

* **Streamlined 2-Tab Architecture**:
  * Maintains only two essential tabs in Google Sheets:
    1. `Master_Patients`: Central clinical multi-schedule registry.
    2. `Medicine`: Formulary repository.
  * Built-in `🧹 Clean Tabs` utility to eliminate obsolete weekly schedule tabs and remove the legacy `Hospital Number` column from `Master_Patients`.

---

## 📁 Repository Structure

```
.
├── Code.gs                 # Google Apps Script backend (Multi-schedule CRUD, formulary engine)
├── index.html              # Responsive single-page web app (HTML5, Vanilla CSS & JS)
├── Setup_Instructions.md   # Deployment guide for Google Apps Script
└── README.md               # Project documentation
```

---

## 🚀 Deployment Instructions

1. Open your [Ambulatory Cancer Treatment Unit Google Sheet](https://docs.google.com/spreadsheets/d/1ry9tud_1ZsuEiqZdMzaQ9a5e4_8ipTK70udu3vYJm48/edit?gid=683243237#gid=683243237).
2. Navigate to **Extensions** > **Apps Script**.
3. Copy the contents of [`Code.gs`](file:///c:/Users/chito/OneDrive/Desktop/Chito/Jungleworks/HR%20files/Chito%20Lates/ACTU/Code.gs) into the script's `Code.gs` file.
4. Create or open `index.html` and copy the contents of [`index.html`](file:///c:/Users/chito/OneDrive/Desktop/Chito/Jungleworks/HR%20files/Chito%20Lates/ACTU/index.html) into it.
5. Click **Deploy** > **Manage deployments** > **Edit** > **New version** > **Deploy**.

For detailed step-by-step instructions, refer to [`Setup_Instructions.md`](file:///c:/Users/chito/OneDrive/Desktop/Chito/Jungleworks/HR%20files/Chito%20Lates/ACTU/Setup_Instructions.md).

---

## 🏥 Institution

**Amang Rodriguez Memorial Medical Center (ARMMC)**  
*Ambulatory Cancer Treatment Unit (ACTU)*
