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

// Interactive Dashboard Frontend UI
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grade 10 Physical Sciences Portal</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --accent-color: #38bdf8;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --border-color: #334155;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 20px;
        }
        h1 { color: var(--accent-color); margin-bottom: 5px; }
        .subtitle { color: var(--text-muted); margin: 0; }
        .chapter-card {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }
        .chapter-title {
            color: var(--accent-color);
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 8px;
            margin-top: 0;
        }
        .section-box {
            background: rgba(255,255,255,0.02);
            border-left: 4px solid var(--accent-color);
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .section-title { margin-top: 0; color: #fff; }
        .definition-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .def-card {
            background: #111827;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
        }
        .def-term { font-weight: bold; color: var(--accent-color); }
        .formula-tag {
            background: #0284c7;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            display: inline-block;
            font-family: monospace;
            font-size: 1.1em;
            margin: 10px 0;
        }
        .example-box {
            background: #0f172a;
            border: 1px dashed #5b21b6;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }
        .example-header { color: #a78bfa; font-weight: bold; margin-bottom: 5px; }
        .loading { text-align: center; font-size: 1.2rem; color: var(--text-muted); }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>⚡ Grade 10 Physical Sciences Portal</h1>
            <p class="subtitle">CAPS Curriculum Modules — Term 1</p>
        </header>
        
        <div id="app"><div class="loading">Loading curriculum study material...</div></div>
    </div>

    <script>
        async function loadCurriculum() {
            try {
                const response = await fetch('/api/lessons');
                const data = await response.json();
                const appDiv = document.getElementById('app');
                appDiv.innerHTML = ''; 

                data.modules.forEach(mod => {
                    const chapterEl = document.createElement('div');
                    chapterEl.className = 'chapter-card';
                    
                    let sectionsHtml = '';
                    mod.sections.forEach(sec => {
                        let defsHtml = '';
                        if(sec.definitions) {
                            defsHtml = '<div class="definition-grid">';
                            sec.definitions.forEach(d => {
                                defsHtml += \`<div class="def-card"><span class="def-term">\${d.term}:</span> \${d.definition}</div>\`;
                            });
                            defsHtml += '</div>';
                        }

                        let formulaHtml = '';
                        if(sec.formula) {
                            formulaHtml = \`<div class="formula-tag">Formula: \${sec.formula}</div>\`;
                        } else if (sec.formulas) {
                            formulaHtml = sec.formulas.map(f => \`<div class="formula-tag">Formula: \${f}</div>\`).join(' ');
                        }

                        let exampleHtml = '';
                        if(sec.worked_example) {
                            exampleHtml = \`
                                <div class="example-box">
                                    <div class="example-header">📝 Worked Example:</div>
                                    <p><strong>Problem:</strong> \${sec.worked_example.problem}</p>
                                    <p><strong>Calculation:</strong> <code>\${sec.worked_example.calculation}</code></p>
                                    <p><strong>Answer:</strong> \${sec.worked_example.answer}</p>
                                </div>
                            \`;
                        }

                        sectionsHtml += \`
                            <div class="section-box">
                                <h3 class="section-title">\${sec.id} \${sec.title}</h3>
                                <p>\${sec.content}</p>
                                \${formulaHtml}
                                \${defsHtml}
                                \${exampleHtml}
                            </div>
                        \`;
                    });

                    chapterEl.innerHTML = \`
                        <h2 class="chapter-title">Chapter \${mod.chapter}: \${mod.title}</h2>
                        \${sectionsHtml}
                    \`;
                    appDiv.appendChild(chapterEl);
                });
            } catch (err) {
                document.getElementById('app').innerHTML = '<p style="color:red;">Error loading layout framework.</p>';
            }
        }
        loadCurriculum();
    </script>
</body>
</html>
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
        const blockBlobClient = containerClient.getBlockBlobClient('lessons.json');
        
        const downloadBlockBlobResponse = await blockBlobClient.download(0);
        const downloadedContent = await streamToText(downloadBlockBlobResponse.readableStreamBody);
        const curriculumData = JSON.parse(downloadedContent);
        
        res.json(curriculumData);
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Physics app listening on port ${port}`);
});
