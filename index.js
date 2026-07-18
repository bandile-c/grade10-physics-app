const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const app = express();
const port = process.env.PORT || 8080;

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

// Helper function to convert an Azure readable stream into text content
async function streamToText(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}

// Welcome / Status route
app.get('/', (req, res) => {
    res.send(`
        <h1>⚡ Grade 10 Physical Sciences Portal</h1>
        <p>Status: Online & Connected to Azure Blob Storage</p>
        <p>Go to <code>/api/lessons</code> to view available Term 1 study material.</p>
    `);
});

// API Route to stream and parse physics curriculum content from Azure
app.get('/api/lessons', async (req, res) => {
    try {
        if (!AZURE_STORAGE_CONNECTION_STRING) {
            return res.status(500).json({ error: "Cloud storage credential filter missing." });
        }
        
        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
        const containerClient = blobServiceClient.getContainerClient('study-material');
        
        // Directly target the lessons.json file in the container
        const blockBlobClient = containerClient.getBlockBlobClient('lessons.json');
        
        // Download the file stream from Azure Blob Storage
        const downloadBlockBlobResponse = await blockBlobClient.download(0);
        
        // Convert that stream into standard text
        const downloadedContent = await streamToText(downloadBlockBlobResponse.readableStreamBody);
        
        // Parse the text into a real JSON object so the frontend can read it instantly
        const curriculumData = JSON.parse(downloadedContent);
        
        // Return the clean CAPS curriculum data directly
        res.json(curriculumData);
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Physics app listening on port ${port}`);
});
