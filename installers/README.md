# 📦 Print Agent Installer Directory

## 🎯 Purpose
This folder contains the WMS Print Agent installer that users can download from the web application.

## 📋 Setup Instructions

### Step 1: Build the Print Agent Installer
```bash
cd ../../wms-print-agent
npm run dist
```

This will create: `wms-print-agent/dist/WMS Print Agent Setup 1.0.0.exe`

### Step 2: Copy Installer Here
Copy the generated installer to this folder and rename it:
```bash
# From wms-print-agent/dist/
Copy "WMS Print Agent Setup 1.0.0.exe" 
To: warehouse-backend/installers/WMS-Print-Agent-Setup.exe
```

**Important:** The file MUST be named exactly: `WMS-Print-Agent-Setup.exe`

### Step 3: Verify
1. Check file exists: `warehouse-backend/installers/WMS-Print-Agent-Setup.exe`
2. File size should be ~150 MB
3. Test download from: `http://localhost:5000/downloads/print-agent`

## 🔄 Update Process

When you update the print agent:
1. Build new installer: `npm run dist`
2. Replace old file in this folder
3. Update version in `warehouse-frontend/app/settings/printers/page.tsx` (line ~508)

## 📊 Current Status

- [❌] Installer file not present
- [  ] Installer ready for download

## 🚀 Production Deployment

### Option A: Include in Backend (Current)
- ✅ Simple setup
- ✅ No external dependencies
- ⚠️ Increases backend deployment size

### Option B: Cloud Storage (Alternative)
Upload to:
- AWS S3
- Google Cloud Storage
- Azure Blob Storage
- Dropbox/Google Drive

Then update download URL in printers/page.tsx

## ⚠️ Important Notes

1. **Git Ignore**: This file is included in .gitignore (150 MB is too large for git)
2. **Deployment**: You'll need to manually add this file to production server
3. **Updates**: Remember to update version number when releasing new builds
4. **Backup**: Keep a backup copy of working installers

## 📞 Support

If download fails:
- Check file exists in this folder
- Verify file name is exactly `WMS-Print-Agent-Setup.exe`
- Check backend server logs for errors
- Ensure file permissions allow reading
