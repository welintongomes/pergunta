let allWords = [];
let filteredWords = [];
let questions = [];
let score = 0;
let timer;
let timeLeft;
let currentIndex = 0;
let delayTimeout;
let db;
let difficulty = 10;
// variavel global verifica se tem alguma leitura em andamento
let isReading = false;
let isStudyMode = false;
// Configurações para lazy loading
const ITEMS_PER_PAGE = 5;
let currentPage = 0;
let isLoading = false;
let hasMoreItems = true;

document.addEventListener('DOMContentLoaded', () => {
    const stats = JSON.parse(localStorage.getItem('sinonimosStats')) || { games: 0, correct: 0, total: 0 };
    document.getElementById('stat-games').textContent = stats.games;
    document.getElementById('stat-correct').textContent = stats.correct;
    document.getElementById('stat-percentage').textContent =
        stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) + '%' : '0%';
});

document.getElementById("auto-read").addEventListener("change", function () {
    if (!this.checked) {
        stopSpeaking();
    }
});

const request = indexedDB.open("SinonimosDB", 1);
request.onupgradeneeded = function (event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains("palavras")) {
        db.createObjectStore("palavras", { keyPath: "word" });
    }
};

request.onsuccess = function (event) {
    db = event.target.result;
    loadWordsFromDB();
};


// 5. Modificar a função loadWordsFromDB para atualizar o seletor de categorias após carregar
function loadWordsFromDB() {
    const tx = db.transaction("palavras", "readonly");
    const store = tx.objectStore("palavras");
    const getAll = store.getAll();
    getAll.onsuccess = () => {
        allWords = getAll.result;
        filteredWords = [...allWords];
        if (allWords.length === 0) {
            const defaults = [
                {
                    "word": "Qual o Sinônimo de anuência?",
                    "correct": "consentimento",
                    "options": ["rejeição", "consentimento", "negação"],
                    "category": "Geral"
                },
                {
                    "word": "Qual o Sinônimo de análogo?",
                    "correct": "semelhante",
                    "options": ["contrário", "semelhante", "diferente"],
                    "category": "Geral"
                }
            ];
            defaults.forEach(w => saveWordToDB(w));
        } else {
            resetWordList();
            updateCategorySelector(); // Atualiza o seletor de categorias após carregar as palavras
        }
    };
}

function saveWordToDB(wordObj) {
    const tx = db.transaction("palavras", "readwrite");
    const store = tx.objectStore("palavras");
    store.put(wordObj);
    tx.oncomplete = () => {
        loadWordsFromDB();
    };
}

// 4. Modificar a função startGame para usar a categoria selecionada
function startGame() {
    difficulty = parseInt(document.getElementById("difficulty").value);
    isStudyMode = (difficulty === 2);
    document.getElementById("game-area").style.display = "block";
    
    // Obtém a categoria selecionada
    const selectedCategory = document.getElementById("category-selector").value;
    
    // Filtra as palavras de acordo com a categoria selecionada
    questions = filterWordsByCategory(selectedCategory);
    
    // Verifica se há palavras na categoria selecionada
    if (questions.length === 0) {
        alert("Não há palavras disponíveis na categoria selecionada.");
        return;
    }
    
    shuffleArray(questions);
    score = 0;
    currentIndex = 0;
    document.getElementById("score").textContent = isStudyMode ? "Modo Estudo" : "";
    loadWord();
}

function loadWord() {
    clearInterval(timer);
    clearTimeout(delayTimeout);
    stopSpeaking();
    timeLeft = difficulty;
    updateTimerDisplay();

    const current = questions[currentIndex];
    if (!current) return endGame();

    document.getElementById("word").textContent = ` ${current.word}`;
    document.getElementById("options").innerHTML = "";
    document.getElementById("result").textContent = "";

    shuffleArray(current.options).forEach(option => {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline-primary";
        btn.textContent = option;
        btn.onclick = () => checkAnswer(option);
        btn.disabled = false;
        document.getElementById("options").appendChild(btn);
    });

    const readBtn = document.getElementById("read-question");
    readBtn.disabled = false;
    readBtn.textContent = "🔊 Ler pergunta";

    if (document.getElementById("auto-read") && document.getElementById("auto-read").checked) {
        setTimeout(() => readCurrentQuestion(false), 50);
    } else {
        // Se não for ler automaticamente, inicia o timer imediatamente
        startTimer();
    }
}

function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft === 0) {
            clearInterval(timer);
            checkAnswer(null);
        }
    }, 1000);
}
function isReadingEnabled() {
    return document.getElementById("auto-read") && document.getElementById("auto-read").checked;
}
function readCurrentQuestion(forcedRead = false) {
    if (!isReadingEnabled() && !forcedRead) {
        return;
    }
    // Desabilita o botão durante a leitura
    const readBtn = document.getElementById("read-question");
    readBtn.disabled = true;
    readBtn.textContent = "🔄 Lendo...";

    const current = questions[currentIndex];
    const questionText = `: ${current.word}`;

    // Lê a pergunta
    if (window.speechSynthesis) {
        // Usando a API nativa SpeechSynthesis
        const speech = new SpeechSynthesisUtterance(questionText);
        speech.lang = 'pt-BR';
        speech.rate = 1.2; // Velocidade da leitura da pergunta

        speech.onend = function () {
            // Após ler a pergunta, espera 2 segundos e lê as opções
            setTimeout(() => {
                const options = current.options;
                let optionsText = "As opções são: ";

                options.forEach((option, index) => {
                    if (index > 0) optionsText += " ,. ";
                    optionsText += option;
                });

                const optionsSpeech = new SpeechSynthesisUtterance(optionsText);
                optionsSpeech.lang = 'pt-BR';
                optionsSpeech.rate = 1.2;//velocidade da leitura das opções

                optionsSpeech.onend = function () {
                    // Reativa o botão quando terminar
                    readBtn.disabled = false;
                    readBtn.textContent = "🔊 Ler pergunta";
                    // INICIA O TIMER AQUI DEPOIS DE LER TUDO
                    startTimer();
                };

                window.speechSynthesis.speak(optionsSpeech);
            }, 200); // Pausa de 1 milisegundo entre a pergunta e as opções
        };

        window.speechSynthesis.speak(speech);
    }
    else if (window.responsiveVoice) {
        // Fallback para ResponsiveVoice se disponível
        responsiveVoice.speak(questionText, "Brazilian Portuguese Female", {
            onend: function () {
                setTimeout(() => {
                    const options = current.options;
                    let optionsText = "opções são: ";

                    options.forEach((option, index) => {
                        if (index > 0) optionsText += ", ";
                        optionsText += option;
                    });

                    responsiveVoice.speak(optionsText, "Brazilian Portuguese Female", {
                        onend: function () {
                            readBtn.disabled = false;
                            readBtn.textContent = "🔊 Ler pergunta";
                            // INICIA O TIMER AQUI DEPOIS DE LER TUDO
                            startTimer();
                        }
                    });
                }, 2000);//---
            }
        });
    }
    else {
        // Se nenhuma API de voz estiver disponível
        alert("Seu navegador não suporta leitura de texto.");
        readBtn.disabled = false;
        readBtn.textContent = "🔊 Ler pergunta";
        // Inicia o timer mesmo sem ler
        startTimer();
    }
}

function updateTimerDisplay() {
    document.getElementById("timer").textContent = `⏳ Tempo: ${timeLeft}s`;
}

function checkAnswer(selected) {
    // Desabilita todos os botões de opções para evitar múltiplas escolhas
    const optionButtons = document.getElementById("options").getElementsByTagName("button");
    for (let i = 0; i < optionButtons.length; i++) {
        optionButtons[i].disabled = true;
    }
    clearInterval(timer);
    stopSpeaking();
    const current = questions[currentIndex];
    
    // Converte a string de respostas corretas em um array
    const correctAnswers = current.correct.split(',').map(answer => answer.trim());
    const resultDiv = document.getElementById("result");
    isReading = true; // Marcar que uma leitura vai começar

    // Recupera as estatísticas atuais
    let stats = JSON.parse(localStorage.getItem('sinonimosStats')) || {
        games: 0,
        correct: 0,
        total: 0
    };

    // Verifica se a resposta selecionada está entre as corretas
    if (correctAnswers.includes(selected)) {
        resultDiv.textContent = "✅ Acertou!";
        resultDiv.style.color = "green";
        // Só incrementa o score se não estiver em modo estudo
        if (!isStudyMode) {
            score++;
            // Atualiza as estatísticas incrementando acertos em tempo real
            stats.correct++;
            stats.total++;
        }
        if (isReadingEnabled() && window.speechSynthesis) {
            const speech = new SpeechSynthesisUtterance("Acertou!");
            speech.lang = 'pt-BR';
            speech.rate = 1.2;
            speech.onend = function () {
                isReading = false; // Leitura terminou
                delayTimeout = setTimeout(() => nextWord(), 1000); // Reduzido para 1 segundo após a leitura
            };
            window.speechSynthesis.speak(speech);
        } else if (isReadingEnabled() && window.responsiveVoice) {
            responsiveVoice.speak("Acertou!", "Brazilian Portuguese Female", {
                onend: function () {
                    isReading = false;
                    delayTimeout = setTimeout(() => nextWord(), 1000);
                }
            });
        } else {
            // Se não houver suporte à síntese de voz, continue normalmente
            isReading = false;
            delayTimeout = setTimeout(() => nextWord(), 3000);
        }

    } else if (selected === null) {
        resultDiv.textContent = "⏰ Tempo!, Resposta: ";
        resultDiv.style.color = "orange";
        document.getElementById("sound-wrong").play();
        // Atualiza apenas o total de questões
        // Só incrementa estatísticas se não estiver em modo estudo
        if (!isStudyMode) {
            // Atualiza apenas o total de questões
            stats.total++;
        }
        const respostaElemento = document.createElement("div"); // Cria um novo elemento div
        respostaElemento.textContent = correctAnswers.join(", ");
        respostaElemento.style.fontSize = "2em"; // Define um tamanho de fonte maior
        respostaElemento.style.fontWeight = "bold"; // Opcional: para deixar em negrito
        resultDiv.appendChild(respostaElemento); // Adiciona o novo elemento ao resultDiv

        if (isReadingEnabled() && window.speechSynthesis) {
            const speech = new SpeechSynthesisUtterance(`Tempo!, resposta: ${correctAnswers.join(", ")}`);
            speech.lang = 'pt-BR';
            speech.rate = 1.2;
            speech.onend = function () {
                isReading = false;
                delayTimeout = setTimeout(() => nextWord(), 1000);
            };
            window.speechSynthesis.speak(speech);
        } else if (isReadingEnabled() && window.responsiveVoice) {
            responsiveVoice.speak(`Tempo!, resposta: ${correctAnswers.join(", ")}`, "Brazilian Portuguese Female", {
                onend: function () {
                    isReading = false;
                    delayTimeout = setTimeout(() => nextWord(), 1000);
                }
            });
        } else {
            isReading = false;
            delayTimeout = setTimeout(() => nextWord(), 3000);
        }

    } else {
        resultDiv.textContent = `❌ Errou! Respostas corretas: ${correctAnswers.join(", ")}`;
        resultDiv.style.color = "red";
        document.getElementById("sound-wrong").play();
        // Atualiza apenas o total de questões
        // Só incrementa estatísticas se não estiver em modo estudo
        if (!isStudyMode) {
            // Atualiza apenas o total de questões
            stats.total++;
        }
        if (isReadingEnabled() && window.speechSynthesis) {
            const speech = new SpeechSynthesisUtterance(`Errou! resposta: ${correctAnswers.join(", ")}`);
            speech.lang = 'pt-BR';
            speech.rate = 1.2;
            speech.onend = function () {
                isReading = false;
                delayTimeout = setTimeout(() => nextWord(), 1000);
            };
            window.speechSynthesis.speak(speech);
        } else if (isReadingEnabled() && window.responsiveVoice) {
            responsiveVoice.speak(`Errou! resposta: ${correctAnswers.join(", ")}`, "Brazilian Portuguese Female", {
                onend: function () {
                    isReading = false;
                    delayTimeout = setTimeout(() => nextWord(), 1000);
                }
            });
        } else {
            isReading = false;
            delayTimeout = setTimeout(() => nextWord(), 3000);
        }
    }
    // Salva as estatísticas atualizadas
    if (!isStudyMode) {
        localStorage.setItem('sinonimosStats', JSON.stringify(stats));

        // Atualiza a exibição das estatísticas
        document.getElementById('stat-correct').textContent = stats.correct;
        document.getElementById('stat-percentage').textContent =
            stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) + '%' : '0%';
    }

    // Mostra pontuação ou "Modo Estudo" dependendo do modo
    document.getElementById("score").textContent = isStudyMode ?
        "Modo Estudo" :
        `Pontuação: ${score}/${questions.length}`;
}

function nextWord() {
    clearTimeout(delayTimeout);

    // Se estiver lendo, só interrompe a leitura, mas não avança para a próxima palavra
    if (isReading) {
        stopSpeaking();
        isReading = false;
        return; // Sai da função sem avançar
    }

    currentIndex++;
    if (currentIndex < questions.length) {
        loadWord();
    } else {
        endGame();
    }
}

function endGame() {
    stopSpeaking();//interrompe a leitura
    document.getElementById("word").textContent = "🏁 Fim de jogo!";
    document.getElementById("options").innerHTML = "";

    // Mostra mensagem diferente dependendo do modo
    if (isStudyMode) {
        document.getElementById("result").textContent = "Modo estudo finalizado!";
    } else {
        document.getElementById("result").textContent = `Pontuação final: ${score}/${questions.length}`;
        // Só atualiza estatísticas se não estiver em modo estudo
        updateStatistics(score, questions.length);
    }

    document.getElementById("timer").textContent = "";

    if (isReadingEnabled() && window.speechSynthesis) {
        const message = isStudyMode ?
            "Fim do modo estudo!" :
            `Fim de jogo! Sua pontuação final é: ${score} de ${questions.length}`;

        const speech = new SpeechSynthesisUtterance(message);
        speech.lang = 'pt-BR';
        speech.rate = 1.2;
        window.speechSynthesis.speak(speech);
    } else if (isReadingEnabled() && window.responsiveVoice) {
        const message = isStudyMode ?
            "Fim do modo estudo!" :
            `Fim de jogo! Sua pontuação final é: ${score} de ${questions.length}`;

        responsiveVoice.speak(message, "Brazilian Portuguese Female");
    }

    document.getElementById("sound-gameover").play(); // som de fim de jogo
}
//configuraçao para interromper a leitura
function stopSpeaking() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    } else if (window.responsiveVoice) {
        responsiveVoice.cancel();
    }
    isReading = false;
}
function updateStatistics(correct, total) {
    // Recuperar estatísticas atuais do localStorage
    let stats = JSON.parse(localStorage.getItem('sinonimosStats')) || {
        games: 0,
        correct: 0,
        total: 0
    };

    // Atualizar estatísticas
    stats.games++;
    // Salvar no localStorage
    localStorage.setItem('sinonimosStats', JSON.stringify(stats));
    // Atualizar a UI
    document.getElementById('stat-games').textContent = stats.games;
    document.getElementById('stat-correct').textContent = stats.correct;
    document.getElementById('stat-percentage').textContent =
        stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) + '%' : '0%';
}
// Ao adicionar uma nova palavra, incluir o campo categoria
function addWord() {
    const word = document.getElementById("admin-word").value.trim();
    const correct = document.getElementById("admin-correct").value.trim();
    const optionsInput = document.getElementById("admin-options").value;
    const options = optionsInput.split(",").map(o => o.trim());
    const category = document.getElementById("admin-category").value.trim() || "Geral"; // Categoria padrão é "Geral"

    if (!word || !correct || options.length > 20) {
        alert("Preencha todos os campos corretamente!");
        return;
    }

    // Verificar se todas as respostas corretas estão nas opções
    const correctAnswers = correct.split(',').map(answer => answer.trim());
    
    // Certifique-se de que todas as respostas corretas estão nas opções
    correctAnswers.forEach(answer => {
        if (!options.includes(answer)) {
            options.push(answer); // Adiciona a resposta correta às opções se não estiver lá
        }
    });

    const newEntry = { word, correct, options, category };
    saveWordToDB(newEntry);
    allWords.push(newEntry);
    document.getElementById("admin-word").value = "";
    document.getElementById("admin-correct").value = "";
    document.getElementById("admin-options").value = "";
    document.getElementById("admin-category").value = "";
    
    // Atualiza o seletor de categorias após adicionar uma nova palavra
    updateCategorySelector();
}

// 2. Função para extrair e atualizar o seletor de categorias
function updateCategorySelector() {
    const categories = ["Todas"]; // A opção "Todas" sempre estará disponível
    
    // Extrai categorias únicas do conjunto de palavras
    allWords.forEach(word => {
        const category = word.category || "Geral";
        if (!categories.includes(category)) {
            categories.push(category);
        }
    });
    
    // Atualiza o seletor de categorias
    const categorySelector = document.getElementById("category-selector");
    categorySelector.innerHTML = "";
    
    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categorySelector.appendChild(option);
    });
}

// 3. Função para filtrar palavras por categoria
function filterWordsByCategory(category) {
    if (category === "Todas") {
        return [...allWords]; // Retorna todas as palavras
    } else {
        return allWords.filter(word => (word.category || "Geral") === category);
    }
}

function exportToJson() {
    const tx = db.transaction("palavras", "readonly");
    const store = tx.objectStore("palavras");
    const req = store.getAll();
    req.onsuccess = () => {
        const blob = new Blob([JSON.stringify(req.result, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "sinonimos.json";
        a.click();
    };
}

function importFromJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const data = JSON.parse(reader.result);
        const tx = db.transaction("palavras", "readwrite");
        const store = tx.objectStore("palavras");
        data.forEach(item => store.put(item));
        tx.oncomplete = () => {
            loadWordsFromDB();
            alert("Importado com sucesso!");
        };
    };
    reader.readAsText(file);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function resetWordList() {
    const list = document.getElementById("word-list");
    list.innerHTML = "";
    currentPage = 0;
    hasMoreItems = true;
    loadMoreWords();

    // Configurar busca
    document.getElementById("search-input").addEventListener("input", handleSearch);

    // Configurar detecção de scroll para lazy loading
    document.querySelector(".word-list-container").addEventListener("scroll", handleScroll);
}

function handleScroll(e) {
    const container = e.target;
    if (isLoading || !hasMoreItems) return;

    // Se estiver perto do final da lista, carrega mais itens
    if (container.scrollHeight - container.scrollTop <= container.clientHeight + 100) {
        loadMoreWords();
    }
}

// 7. Modificar a função loadMoreWords para mostrar a categoria
function loadMoreWords() {
    if (isLoading || !hasMoreItems) return;

    isLoading = true;
    document.getElementById("loading-more").style.display = "block";

    setTimeout(() => {
        const list = document.getElementById("word-list");
        const startIndex = currentPage * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const itemsToShow = filteredWords.slice(startIndex, endIndex);

        if (itemsToShow.length === 0) {
            hasMoreItems = false;
            document.getElementById("loading-more").style.display = "none";

            if (currentPage === 0) {
                document.getElementById("no-results").style.display = "block";
            }

            isLoading = false;
            return;
        }

        itemsToShow.forEach(item => {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-start";

            // Exibe as respostas corretas separadas por vírgula
            const correctAnswers = item.correct.split(',').map(answer => answer.trim());
            const text = document.createElement("div");
            text.innerHTML = `<strong>${item.word}</strong> [${item.category || "Geral"}]: ${item.options.join(", ")} (✅ ${correctAnswers.join(", ")})`;
            li.appendChild(text);

            const btnGroup = document.createElement("div");
            btnGroup.className = "btn-group";

            const editBtn = document.createElement("button");
            editBtn.className = "btn btn-sm btn-warning";
            editBtn.textContent = "Editar";
            editBtn.onclick = () => editWord(item);

            const deleteBtn = document.createElement("button");
            deleteBtn.className = "btn btn-sm btn-danger";
            deleteBtn.textContent = "Excluir";
            deleteBtn.onclick = () => deleteWord(item.word);

            btnGroup.appendChild(editBtn);
            btnGroup.appendChild(deleteBtn);
            li.appendChild(btnGroup);

            list.appendChild(li);
        });

        currentPage++;
        isLoading = false;
        document.getElementById("loading-more").style.display = hasMoreItems ? "block" : "none";
    }, 300); // Simula um pequeno atraso de carregamento para melhor UX
}

// 8. Modificar a função handleSearch para incluir a categoria na busca
function handleSearch() {
    const searchTerm = document.getElementById("search-input").value.toLowerCase().trim();

    if (searchTerm === "") {
        filteredWords = [...allWords];
    } else {
        filteredWords = allWords.filter(item =>
            item.word.toLowerCase().includes(searchTerm) ||
            item.correct.toLowerCase().includes(searchTerm) ||
            (item.category && item.category.toLowerCase().includes(searchTerm)) ||
            item.options.some(opt => opt.toLowerCase().includes(searchTerm))
        );
    }

    // Resetar a lista e mostrar os resultados filtrados
    document.getElementById("word-list").innerHTML = "";
    document.getElementById("no-results").style.display = "none";
    currentPage = 0;
    hasMoreItems = true;
    loadMoreWords();
}

function clearSearch() {
    document.getElementById("search-input").value = "";
    filteredWords = [...allWords];
    document.getElementById("word-list").innerHTML = "";
    document.getElementById("no-results").style.display = "none";
    currentPage = 0;
    hasMoreItems = true;
    loadMoreWords();
}

// 6. Modificar a função editWord para incluir a categoria
function editWord(item) {
    document.getElementById("admin-word").value = item.word;
    document.getElementById("admin-correct").value = item.correct;
    document.getElementById("admin-options").value = item.options.join(", ");
    document.getElementById("admin-category").value = item.category || "Geral";
}

function deleteWord(word) {
    if (confirm(`Tem certeza que deseja excluir a palavra "${word}"?`)) {
        const tx = db.transaction("palavras", "readwrite");
        const store = tx.objectStore("palavras");
        store.delete(word);
        tx.oncomplete = () => {
            loadWordsFromDB();
        };
    }
}
function alertBackgroundLimitations() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
        alert("Em dispositivos iOS, a narração pode parar quando a tela for bloqueada. Para melhor experiência, mantenha a tela ativa durante o uso ou instale como aplicativo pela opção 'Adicionar à Tela Inicial'.");
    }
}
// Chame essa função quando o usuário iniciar o jogo com narração ativada
