console.log('Content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log('Received message from background script:', request);
    if (request.action === 'displaySummary') {
        displaySummary(request.summary, request.textContent);
    }
});

function injectSummaryButton() {
    const paperLinkElement = document.querySelector('a.btn.inline-flex.h-9.items-center[href*="/pdf/"]');
    if (paperLinkElement && !document.querySelector('.view-summary-button')) {
        const viewSummaryButton = document.createElement('button');
        viewSummaryButton.textContent = 'View Summary';
        viewSummaryButton.classList.add('view-summary-button');
        viewSummaryButton.style.marginLeft = '10px';
        viewSummaryButton.style.padding = '6px 12px';
        viewSummaryButton.style.backgroundColor = '#4CAF50';
        viewSummaryButton.style.color = 'white';
        viewSummaryButton.style.border = 'none';
        viewSummaryButton.style.borderRadius = '4px';
        viewSummaryButton.style.cursor = 'pointer';

        const summaryLengthDropdown = document.createElement('select');
        summaryLengthDropdown.classList.add('summary-length-dropdown');
        summaryLengthDropdown.style.marginLeft = '10px';
        summaryLengthDropdown.style.padding = '6px';
        summaryLengthDropdown.style.border = '1px solid #ccc';
        summaryLengthDropdown.style.borderRadius = '4px';
        summaryLengthDropdown.innerHTML = `
            <option value="Analogy Explanation">Analogy Explanation</option>
            <option value="Explain like I am 5" selected>Explain like I am 5</option>
            <option value="Detailed">Detailed</option>
        `;


        viewSummaryButton.addEventListener('click', function () {
            viewSummaryButton.textContent = 'Loading...';
            viewSummaryButton.disabled = true;


            const paperLink = paperLinkElement.getAttribute('href');
            if (paperLink) {
                console.log('Downloading paper:', paperLink);
                downloadPaper(paperLink) //+ '.pdf'
                    .then(pdfBlob => {
                        console.log('Paper downloaded successfully');
                        return extractPDFText(pdfBlob);
                    })
                    .then(textContent => {
                        console.log('PDF text extracted successfully');
                        const summaryLength = summaryLengthDropdown.value;
                        chrome.runtime.sendMessage({ action: 'receivePaperContent', textContent, summaryLength });
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        chrome.runtime.sendMessage({ action: 'receivePaperContent', error: error.message });
                        viewSummaryButton.textContent = 'View Summary';
                        viewSummaryButton.disabled = false;
                    });
            } else {
                console.log('Paper link not found');
                chrome.runtime.sendMessage({ action: 'receivePaperContent', error: 'Paper link not found' });
                viewSummaryButton.textContent = 'View Summary';
                viewSummaryButton.disabled = false;
            }
        });

        paperLinkElement.insertAdjacentElement('afterend', viewSummaryButton);
        viewSummaryButton.insertAdjacentElement('afterend', summaryLengthDropdown);
    }
}

function displaySummary(summary, textContent) {
    const viewSummaryButton = document.querySelector('.view-summary-button');
    if (viewSummaryButton) {
        viewSummaryButton.textContent = 'View Summary';
        viewSummaryButton.disabled = false;
    }

    const summaryContainer = document.createElement('div');
    summaryContainer.id = 'paper-summary-container';
    summaryContainer.style.position = 'fixed';
    summaryContainer.style.top = '20px';
    summaryContainer.style.right = '20px';
    summaryContainer.style.width = '400px';
    summaryContainer.style.maxHeight = '80vh';
    summaryContainer.style.overflowY = 'auto';
    summaryContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    summaryContainer.style.padding = '20px';
    summaryContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    summaryContainer.style.zIndex = '9999';

    if (typeof summary === 'string') {
        const titleLine = summary.split('\n')[0];
        const authorsLine = summary.split('\n')[1];
        const yearLine = summary.split('\n')[2];
        const summaryText = summary.split('\n').slice(3).join('\n');

        summaryContainer.innerHTML = `
            <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
                <button id="theme-toggle-btn" style="font-family: 'Arial', sans-serif; font-size: 14px; font-weight: bold; padding: 8px 16px; background-color: #9C27B0; color: white; border: none; border-radius: 4px; cursor: pointer;">Dark</button>
            </div>
            <h1 style="font-family: 'Georgia', serif; font-size: 32px; font-weight: bold; color: #333;">HuggingBuddy</h1>
            <h2 style="font-family: 'Arial', sans-serif; font-size: 20px; font-weight: bold; color: #555;">${marked.parse(titleLine)}</h2>
            
            <div id="summary-text" style="font-family: 'Georgia', serif; font-size: 16px;">${marked.parse(summaryText)}</div>
            <h3 style="font-family: 'Arial', sans-serif; font-size: 20px; font-weight: bold; color: #666;">Related Questions:</h3>
            <ol id="related-questions" style="font-family: 'Georgia', serif; font-size: 16px;"></ol>
            <div id="question-answer-container" style="display: none;"></div>
            <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                <button id="copy-text-btn" style="font-family: 'Arial', sans-serif; font-size: 14px; font-weight: bold; padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Copy Text</button>
                <button id="listen-summary-btn" style="font-family: 'Arial', sans-serif; font-size: 14px; font-weight: bold; padding: 8px 16px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">Listen to Summary</button>
            </div>
            <p style="font-family: 'Georgia', serif; font-size: 14px; color: #888; margin-top: 20px;">Summary powered by Google Gemini Model</p>
        `;

        const themeToggleBtn = summaryContainer.querySelector('#theme-toggle-btn');
        if (themeToggleBtn) {
            if (document.body.classList.contains('dark-mode')) {
                themeToggleBtn.textContent = 'Light';
                summaryContainer.style.backgroundColor = 'rgba(51, 51, 51, 0.9)';
                summaryContainer.style.color = 'white';
                const headings = summaryContainer.querySelectorAll('h1, h2, h3');
                headings.forEach(heading => {
                    heading.style.color = '#FFD700';
                });
            } else {
                themeToggleBtn.textContent = 'Dark';
                summaryContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                summaryContainer.style.color = 'black';
                const headings = summaryContainer.querySelectorAll('h1, h2, h3');
                headings.forEach(heading => {
                    heading.style.color = '';
                });
            }

            themeToggleBtn.addEventListener('click', function () {
                document.body.classList.toggle('dark-mode');
                if (document.body.classList.contains('dark-mode')) {
                    themeToggleBtn.textContent = 'Light';
                    summaryContainer.style.backgroundColor = 'rgba(51, 51, 51, 0.9)';
                    summaryContainer.style.color = 'white';
                    const summaryText = summaryContainer.querySelector('#summary-text');
                    const relatedQuestions = summaryContainer.querySelector('#related-questions');
                    if (summaryText && relatedQuestions) {
                        summaryText.style.color = 'white';
                        relatedQuestions.style.color = 'white';
                    }
                    const headings = summaryContainer.querySelectorAll('h1, h2, h3');
                    headings.forEach(heading => {
                        heading.style.color = '#FFD700';
                    });
                } else {
                    themeToggleBtn.textContent = 'Dark';
                    summaryContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                    summaryContainer.style.color = 'black';
                    const summaryText = summaryContainer.querySelector('#summary-text');
                    const relatedQuestions = summaryContainer.querySelector('#related-questions');
                    if (summaryText && relatedQuestions) {
                        summaryText.style.color = 'black';
                        relatedQuestions.style.color = 'black';
                    }
                    const headings = summaryContainer.querySelectorAll('h1, h2, h3');
                    headings.forEach(heading => {
                        heading.style.color = '';
                    });
                }
            });
        }

        const copyTextBtn = summaryContainer.querySelector('#copy-text-btn');
        if (copyTextBtn) {
            copyTextBtn.addEventListener('click', function () {
                const summaryText = summaryContainer.querySelector('#summary-text');
                if (summaryText) {
                    navigator.clipboard.writeText(summaryText.textContent)
                        .then(() => console.log('Summary text copied to clipboard'))
                        .catch(err => console.error('Failed to copy summary text: ', err));
                }
            });
        }

        const listenSummaryBtn = summaryContainer.querySelector('#listen-summary-btn');
        if (listenSummaryBtn) {
            listenSummaryBtn.addEventListener('click', function () {
                const summaryText = summaryContainer.querySelector('#summary-text');
                if (summaryText) {
                    speakSummary(summaryText.textContent);
                }
            });
        }

        const relatedQuestionsContainer = summaryContainer.querySelector('#related-questions');
        const questionAnswerContainer = summaryContainer.querySelector('#question-answer-container');

        if (relatedQuestionsContainer) {
            generateRelatedQuestions(textContent)
                .then(questions => {
                    questions.forEach((question, index) => {
                        const questionElement = document.createElement('li');
                        questionElement.textContent = `${question}`;
                        questionElement.style.cursor = 'pointer';
                        questionElement.addEventListener('click', () => {
                            getQuestionAnswer(question, questionAnswerContainer, questionElement);
                        });
                        relatedQuestionsContainer.appendChild(questionElement);
                    });
                })
                .catch(error => console.error('Error generating related questions:', error));
        }

    } else if (typeof summary === 'object' && summary.error) {
        summaryContainer.innerHTML = `
            <h2 style="margin-top: 0;">Error</h2>
            <div style="color: red;">${summary.error}</div>
            <button id="close-btn" style="margin-top: 10px; padding: 4px 8px; font-size: 12px; background-color: #ccc; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
        `;

        const closeBtn = summaryContainer.querySelector('#close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                summaryContainer.remove();
            });
        }
    }

    document.body.appendChild(summaryContainer);
}

function getQuestionAnswer(question, questionAnswerContainer, questionElement) {
    // Clear any previous answer or loading indicator
    questionAnswerContainer.innerHTML = '';

    // Add a loading indicator
    const loadingIndicator = document.createElement('p');
    loadingIndicator.textContent = 'Loading...';
    loadingIndicator.style.fontFamily = 'Georgia, serif';
    loadingIndicator.style.fontSize = '16px';
    questionAnswerContainer.appendChild(loadingIndicator);

    // Highlight the clicked question
    const relatedQuestions = questionAnswerContainer.parentNode.querySelector('#related-questions');
    const questionItems = relatedQuestions.querySelectorAll('li');
    questionItems.forEach(item => {
        item.style.backgroundColor = '';
    });
    questionElement.style.backgroundColor = '#f0f0f0';

    chrome.runtime.sendMessage({ action: 'generateQuestionAnswer', question }, response => {
        if (chrome.runtime.lastError) {
            console.error('Error generating question answer:', chrome.runtime.lastError);
        } else {
            // Remove the loading indicator
            questionAnswerContainer.removeChild(loadingIndicator);

            if (response.answer) {
                questionAnswerContainer.style.display = 'block';
                questionAnswerContainer.innerHTML = `
                    <h4 style="font-family: 'Arial', sans-serif; font-size: 18px; font-weight: bold; color: #666;">Answer:</h4>
                    <p style="font-family: 'Georgia', serif; font-size: 16px;">${marked.parse(response.answer)}</p>
                `;
            } else {
                questionAnswerContainer.style.display = 'block';
                questionAnswerContainer.innerHTML = `
                    <p style="font-family: 'Georgia', serif; font-size: 16px; color: red;">No answer found for the given question.</p>
                `;
            }
        }
    });
}

function speakSummary(summaryText) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(summaryText);
        window.speechSynthesis.speak(utterance);
    } else {
        console.log('Speech synthesis not supported');
    }
}

function downloadPaper(url) {
    console.log('Downloading paper from:', url);
    return fetch(url)
        .then(response => {
            console.log('Download response status:', response.status);
            if (!response.ok) {
                console.error('Failed to download paper. HTTP error:', response.status);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.blob();
        })
        .catch(error => {
            console.error('Error downloading paper:', error);
            throw error;
        });
}

function extractPDFText(pdfBlob) {
    console.log('Extracting text from PDF');
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            console.log('File reader onload');
            const pdfData = new Uint8Array(this.result);
            console.log('PDF data length:', pdfData.length);
            const loadingTask = pdfjsLib.getDocument(pdfData);
            loadingTask.promise
                .then(async pdf => {
                    console.log('PDF loaded');
                    const numPages = pdf.numPages;
                    console.log('Number of pages:', numPages);

                    const pagePromises = [];
                    for (let i = 1; i <= numPages; i++) {
                        pagePromises.push(pdf.getPage(i));
                    }

                    const pages = await Promise.all(pagePromises);
                    const textPromises = pages.map(page => page.getTextContent());
                    const texts = await Promise.all(textPromises);

                    const pagesText = texts.map(textContent => textContent.items.map(item => item.str).join(' ')).join(' ');

                    resolve(pagesText);
                })
                .catch(error => {
                    console.error('Error loading PDF:', error);
                    reject(error);
                });
        };
        fileReader.onerror = function () {
            console.error('Error reading the PDF file');
            reject(new Error('Error reading the PDF file.'));
        };
        fileReader.readAsArrayBuffer(pdfBlob);
    });
}

function generateRelatedQuestions(textContent) {
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage({ action: 'generateRelatedQuestions', textContent }, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response.questions);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

window.addEventListener('load', injectSummaryButton);