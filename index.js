const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const app = express();
const port = process.env.PORT || 8080;

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

// Welcome / Status route
app.get('/', (req, res) => {
    res.send(`
        <h1>⚡ Grade 10 Physical Sciences Portal</h1>
        <p>Status: Online & Connected to Azure Blob Storage</p>
        <p>Go to <code>/api/lessons</code> to view available Term 1 study material.</p>
    `);
});

// API Route to fetch available physics material from Azure
app.get('/api/lessons', async (req, res) => {
    try {
        if (!AZURE_STORAGE_CONNECTION_STRING) {
            return res.status(500).json({ error: "Cloud storage credential filter missing." });
        }
        
        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
        const containerClient = blobServiceClient.getContainerClient('study-material');
        
        let modules = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            modules.push({
                fileName: blob.name,
                url: `https://${blobServiceClient.accountName}.blob.core.windows.net/study-material/${blob.name}`,
                lastUpdated: blob.properties.lastModified
            });
        }
        
        res.json({
            curriculum: "CAPS South Africa",
            grade: "10",
            term: "1",
            subject: "Physical Sciences",
            totalFiles: modules.length,
            modules: modules
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Physics app listening on port ${port}`);
});