console.log('Background script loaded');

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'generateQuestionAnswer') {
        const question = request.question;
        generateQuestionAnswer(question)
            .then(answer => {
                console.log('Answer:', answer);
                sendResponse({ answer });
            })
            .catch(error => {
                console.error('Error generating question answer:', error);
                sendResponse({ error: error.message });
            });
        return true; // Keep the message channel open for asynchronous response
    }
    if (request.action === 'receivePaperContent') {
        if (request.textContent) {
            const textContent = request.textContent;
            const summaryLength = request.summaryLength;
            console.log('PDF parsed successfully');
            summarizePaperWithGemini(textContent, summaryLength)
                .then(summary => {
                    console.log('Summary:', summary);
                    sendSummaryToContentScript(summary, textContent, sender.tab.id);
                })
                .catch(error => {
                    console.error('Error:', error);
                    sendMessageToContentScript({ action: 'displaySummary', error: error.message }, sender.tab.id);
                });
        } else if (request.error) {
            console.error(request.error);
            sendMessageToContentScript({ action: 'displaySummary', error: request.error }, sender.tab.id);
        }
    } else if (request.action === 'generateRelatedQuestions') {
        generateRelatedQuestions(request.textContent)
            .then(questions => {
                console.log('Related questions:', questions);
                sendResponse({ questions });
            })
            .catch(error => {
                console.error('Error generating related questions:', error);
                sendResponse({ error: error.message });
            });
        return true; // Keep the message channel open for asynchronous response
    }
});

function sendMessageToContentScript(message, tabId) {
    try {
        console.log('Sending message to content script:', message);
        chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
        console.error('Error sending message to content script:', error);
        // Handle the error appropriately, e.g., log it, display an error message, or take alternative action
    }
}

function sendSummaryToContentScript(summary, textContent, tabId) {
    try {
        if (typeof summary === 'string') {
            chrome.tabs.sendMessage(tabId, { action: 'displaySummary', summary, textContent });
        } else {
            chrome.tabs.sendMessage(tabId, { action: 'displaySummary', error: summary.message });
        }
    } catch (error) {
        console.error('Error sending message to content script:', error);
        // Handle the error appropriately, e.g., log it, display an error message, or take alternative action
    }
}

function summarizePaperWithGemini(textContent, summaryLength) {
    const apiKey = ''; // Replace with your actual API key
    const apiUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';
    let prompt;
    if (summaryLength === 'Analogy Explanation') {
        prompt = ` You're a research assistant. Please provide a summary of this paper in the  following format:
        Title: 
        Authors: 
        Year: 
        Journal/Conference: 
        Summary:
        Please provide me 10 to 20 lines of short explanation or only analogy explanation
        `;
    } else if (summaryLength === 'Explain like I am 5') {
        prompt = `You're a research assistant. Please provide a summary of this paper in the  following format:
        Title: 
        Authors: 
        Year: 
        Journal/Conference: 
        Summary:
        Explain the main points of the paper as if you were talking to a 5-year-old. Use simple language and real-world examples a child could understand. Divide the explanation into sections that discuss the research problem, how the researchers tried to solve it, what they found out, and why it's important.
        Limitations:
        Talk about the parts of the study that didn't work out as well as the researchers hoped, or what they didn't figure out, using simple terms and concepts.
        Future Work:
        Suggest ideas for what researchers or scientists could try to learn next about the topic, using child-friendly language and concepts.`;
    } else if (summaryLength === 'Detailed') {
        prompt = `You're a research assistant. Please provide a summary of this paper in the  following format:

            Title: 
            Authors: 
            Year: 
            Journal/Conference: 

            Summary:
            Concise summary of the paper, including the research problem, methodology, key findings, and contributions. The summary should be divided into clear sections or paragraphs covering the essential elements of the paper.

            Limitations:
            Discuss any limitations or weaknesses of the study mentioned in the paper or that you have identified.

            Future Work:
            Suggest potential areas for future research or extensions based on the paper's findings or limitations.

            Your Response:`;
    }
    //console.log('Summarizing paper with text:', textContent);
    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: prompt,
                    },
                    {
                        text: textContent
                    },
                ],
            },
        ]
    };


    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
    };

    return fetch(apiUrl, requestOptions)
        .then(response => response.json())
        .then(data => {
            console.log('Response from API:', data);
            if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
                throw new Error("Unexpected response format from API");
            }
            if (!data.candidates[0].content || !data.candidates[0].content.parts || !Array.isArray(data.candidates[0].content.parts) || data.candidates[0].content.parts.length === 0) {
                throw new Error("Unexpected response format from API");
            }
            const summary = data.candidates[0].content.parts[0].text;
            return summary;
        })
        .catch(error => {
            console.error('Error summarizing paper:', error);
            sendMessageToContentScript({ action: 'displaySummary', error: error.message });
            throw error;
        });
}

function generateRelatedQuestions(textContent) {
    const apiKey = ''; // Replace with your actual API key
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    const prompt = `Based on the following text, generate maximum of five related questions that could be asked about the content wihtout answers:

                            ${textContent}:
                    Related Questions
1.
2.
3.
4.
5.
                        `;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: prompt,
                    },
                ],
            },
        ],
    };

    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
    };

    return fetch(apiUrl, requestOptions)
        .then(response => response.json())
        .then(data => {
            console.log('Response from API:', data);
            if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
                throw new Error("Unexpected response format from API");
            }
            if (!data.candidates[0].content || !data.candidates[0].content.parts || !Array.isArray(data.candidates[0].content.parts) || data.candidates[0].content.parts.length === 0) {
                throw new Error("Unexpected response format from API");
            }
            const questions = data.candidates[0].content.parts[0].text.split('\n').map(q => q.trim());
            return questions;
        })
        .catch(error => {
            console.error('Error generating related questions:', error);
            sendMessageToContentScript({ action: 'displaySummary', error: error.message });
            throw error;
        });
}

function generateQuestionAnswer(question) {
    const apiKey = ''; // Replace with your actual API key
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    const prompt = `Question: ${question}\n\nAnswer: `;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: prompt,
                    },
                ],
            },
        ],
    };

    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
    };

    return fetch(apiUrl, requestOptions)
        .then(response => response.json())
        .then(data => {
            console.log('Response from API:', data);
            if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
                throw new Error("Unexpected response format from API");
            }
            if (!data.candidates[0].content || !data.candidates[0].content.parts || !Array.isArray(data.candidates[0].content.parts) || data.candidates[0].content.parts.length === 0) {
                throw new Error("Unexpected response format from API");
            }
            const answer = data.candidates[0].content.parts[0].text.trim()//.split('\n').slice(1).join('\n');

            return answer;
        })
        .catch(error => {
            console.error('Error generating question answer:', error);
            sendMessageToContentScript({ action: 'displaySummary', error: error.message });
            throw error;
        });
} 