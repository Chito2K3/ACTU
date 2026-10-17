# Amang Rodriguez Memorial Medical Center (ARMMC)
## Ambulatory Cancer Treatment Unit (ACTU) - Web Application

A modern, responsive Google Apps Script Single-Page Application (SPA) designed for the Ambulatory Cancer Treatment Unit at Amang Rodriguez Memorial Medical Center.

---

## 🌟 Key Features

* **Direct Patient Treatment Registry**:
  * Connected directly to `Master_Patients` in Google Sheets.
  * Real-time search across Patient Name, Diagnosis, Medicine Protocol, Dosage, and Last Visit Date.
  * Instant auto-fill of returning patient details.

* **Deduplicated Medicine Repository**:
  * Live searchable formulary with all duplicate medicine names removed.
  * Pure, clean medicine descriptions (DMR codes excluded from clinical view).
  * Auto-focuses the **Dosage / Quantity Required** field upon medicine selection.

* **On-the-Fly Medicine Addition**:
  * Ability to add unlisted medicines directly from the Chemo Protocol dropdown or the Medicine Repository browser into the `Medicine` tab in Google Sheets.

* **Automated Last Visit Tracking**:
  * Stamps the current date (`YYYY-MM-DD`) on every patient treatment registration or update.

* **Streamlined 2-Tab Architecture**:
  * Maintains only two essential tabs in Google Sheets:
    1. `Master_Patients`: Central clinical registry.
    2. `Medicine`: Formulary repository.
  * Built-in `🧹 Clean Tabs` utility to eliminate obsolete weekly schedule tabs.

---

## 📁 Repository Structure

```
.
├── Code.gs                 # Google Apps Script backend (Direct CRUD, formulary engine)
├── index.html              # Responsive single-page web app (HTML5, Vanilla CSS & JS)
├── Setup_Instructions.md   # Deployment guide for Google Apps Script
└── README.md               # Project documentation
```

---

## 🚀 Deployment Instructions

1. Open your Google Spreadsheet.
2. Navigate to **Extensions** > **Apps Script**.
3. Copy the contents of `Code.gs` into the script's `Code.gs` file.
4. Create an HTML file named `index` and copy the contents of `index.html` into it.
5. Click **Deploy** > **New deployment** > **Web app**.
6. Set access permissions and deploy!

For detailed instructions, refer to [`Setup_Instructions.md`](Setup_Instructions.md).

---

## 🏥 Institution

**Amang Rodriguez Memorial Medical Center (ARMMC)**  
*Ambulatory Cancer Treatment Unit (ACTU)*
