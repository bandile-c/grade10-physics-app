const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const app = express();
const port = process.env.PORT || 8080;

// Express middleware to parse incoming JSON data from the quiz submission
app.use(express.json());

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
            --success-color: #22c55e;
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

        /* Student Login Modal Styles */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .modal-box {
            background: var(--card-bg);
            border: 1px solid var(--accent-color);
            padding: 30px;
            border-radius: 12px;
            width: 90%;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .modal-box input {
            width: 100%;
            padding: 12px;
            margin: 15px 0;
            border-radius: 6px;
            border: 1px solid var(--border-color);
            background: #0f172a;
            color: #fff;
            box-sizing: border-box;
        }
        .modal-box button, .quiz-btn {
            background: var(--accent-color);
            color: #0f172a;
            font-weight: bold;
            border: none;
            padding: 12px 20px;
            border-radius: 6px;
            cursor: pointer;
            width: 100%;
            font-size: 1em;
        }
        .modal-box button:hover, .quiz-btn:hover {
            opacity: 0.9;
        }

        /* Quiz UI Styles */
        .quiz-card {
            background: #1e1b4b;
            border: 1px solid #6366f1;
            border-radius: 12px;
            padding: 25px;
            margin-top: 40px;
        }
        .option-btn {
            display: block;
            width: 100%;
            background: #312e81;
            color: #fff;
            border: 1px solid #4338ca;
            padding: 10px;
            margin: 8px 0;
            border-radius: 6px;
            text-align: left;
            cursor: pointer;
        }
        .option-btn:hover { background: #3730a3; }
        .user-badge {
            float: right;
            background: #0284c7;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
        }
    </style>
</head>
<body>
    <!-- Login Modal -->
    <div id="loginModal" class="modal-overlay">
        <div class="modal-box">
            <h2>👋 Welcome, Physics Student!</h2>
            <p style="color: var(--text-muted);">Enter your email address to access your CAPS summary & weekly practice quiz:</p>
            <form id="loginForm">
                <input type="email" id="studentEmailInput" placeholder="student@gmail.com" required />
                <button type="submit">Start Learning 🚀</button>
            </form>
        </div>
    </div>

    <div class="container">
        <header>
            <span id="userBadge" class="user-badge" style="display:none;"></span>
            <h1>⚡ Grade 10 Physical Sciences Portal</h1>
            <p class="subtitle">CAPS Curriculum Modules — Term 1</p>
        </header>
        
        <div id="app"><div class="loading">Loading curriculum study material...</div></div>

        <!-- Grade 10 Physics Practice Quiz Section -->
        <div id="quizContainer" class="quiz-card" style="display: none;">
            <h2 style="color: #a5b4fc; margin-top: 0;">🎯 Quick Practice Check: CAPS Vectors & Motion</h2>
            <div id="quizContent">
                <p id="quizQuestion" style="font-size: 1.1em; font-weight: bold;"></p>
                <div id="quizOptions"></div>
            </div>
            <div id="quizResult" style="display:none; text-align:center;">
                <h3 style="color: var(--success-color);">Awesome job! Quiz Submitted 🎉</h3>
                <p id="scoreText"></p>
                <p style="color: var(--text-muted);">Your progress and answers have been recorded for your tutor.</p>
            </div>
        </div>
    </div>

    <script>
        let studentEmail = "";
        let currentQuestion = 0;
        let score = 0;

       const quizData = [
            {
                question: "1. Which of the following is a VECTOR quantity?",
                options: ["A) Time (seconds)", "B) Velocity (m/s East)", "C) Mass (kg)", "D) Distance (meters)"],
                answer: 1
            },
            {
                question: "2. What is the unit of measurement for Acceleration in CAPS Physics?",
                options: ["A) m/s", "B) N/kg", "C) m/s²", "D) kg·m/s"],
                answer: 2
            },
            {
                question: "3. What is the rate of change of position called?",
                options: ["A) Speed", "B) Velocity", "C) Acceleration", "D) Displacement"],
                answer: 1
            },
            {
                question: "4. Which of the following is an example of a SCALAR quantity?",
                options: ["A) Force", "B) Displacement", "C) Temperature", "D) Acceleration"],
                answer: 2
            },
            {
                question: "5. What is the standard SI unit for Gravitational Potential Energy?",
                options: ["A) Watt (W)", "B) Newton (N)", "C) Joule (J)", "D) Pascal (Pa)"],
                answer: 2
            },
            {
                question: "6. An object falls freely towards Earth (ignoring air resistance). What happens to its Mechanical Energy?",
                options: ["A) It increases", "B) It decreases", "C) It remains constant", "D) It drops to zero"],
                answer: 2
            },
            {
                question: "7. Which formula is used to calculate the Kinetic Energy of an object?",
                options: ["A) Ek = mgh", "B) Ek = ½mv²", "C) Ek = F × d", "D) Ek = v / t"],
                answer: 1
            },
            {
                question: "8. Like electric charges (e.g., two positive charges) will always:",
                options: ["A) Attract each other", "B) Repel each other", "C) Neutralize completely", "D) Have no effect"],
                answer: 1
            },
            {
                question: "9. According to the Principle of Conservation of Charge, charge can be:",
                options: ["A) Created but not destroyed", "B) Destroyed but not created", "C) Transferred from one object to another", "D) Permanently lost"],
                answer: 2
            },
            {
                question: "10. What is the net displacement of a student who walks 5 meters North and then 5 meters South?",
                options: ["A) 10 meters North", "B) 10 meters", "C) 5 meters South", "D) 0 meters"],
                answer: 3
            }
        ];

        // Handle Login Modal Submission
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            studentEmail = document.getElementById('studentEmailInput').value;
            if(studentEmail) {
                document.getElementById('loginModal').style.display = 'none';
                document.getElementById('userBadge').innerText = "👤 " + studentEmail;
                document.getElementById('userBadge').style.display = 'block';
                document.getElementById('quizContainer').style.display = 'block';
                loadCurriculum();
                loadQuiz();
            }
        });

        function loadQuiz() {
            if(currentQuestion < quizData.length) {
                const q = quizData[currentQuestion];
                document.getElementById('quizQuestion').innerText = q.question;
                const optionsDiv = document.getElementById('quizOptions');
                optionsDiv.innerHTML = '';
                
                q.options.forEach((opt, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'option-btn';
                    btn.innerText = opt;
                    btn.onclick = () => selectOption(idx);
                    optionsDiv.appendChild(btn);
                });
            } else {
                finishQuiz();
            }
        }

        function selectOption(idx) {
            if(idx === quizData[currentQuestion].answer) {
                score++;
            }
            currentQuestion++;
            loadQuiz();
        }

        async function finishQuiz() {
            document.getElementById('quizContent').style.display = 'none';
            document.getElementById('quizResult').style.display = 'block';
            document.getElementById('scoreText').innerText = \`You scored \${score} out of \${quizData.length}!\`;

            // Log Student Score & Email to Backend API
            try {
                await fetch('/api/quiz-submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: studentEmail,
                        score: score,
                        total: quizData.length,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch(err) {
                console.log('Error logging quiz results:', err);
            }
        }

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

// API Route to log student login and quiz results
app.post('/api/quiz-submit', (req, res) => {
    const { email, score, total, timestamp } = req.body;
    console.log(`[STUDENT ACCESS & QUIZ LOGGED] Email: ${email} | Score: ${score}/${total} | Time: ${timestamp}`);
    
    // Returns confirmation back to student interface
    res.json({ success: true, message: "Activity logged successfully." });
});

app.listen(port, () => {
    console.log(`Physics app listening on port ${port}`);
});
