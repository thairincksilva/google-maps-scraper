const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

// Rota raiz
app.get("/", (req, res) => {
  res.send("Bem vindo ao Scraper Google Maps");
});

// Rota de busca no Google Maps
app.get("/search", async (req, res) => {
  const searchTerm = req.query.term;

  if (!searchTerm) {
    return res.status(400).json({ error: "O parâmetro 'term' é obrigatório." });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/google-chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--lang=pt-BR",
      ],
      protocolTimeout: 30000,
    });

    const page = await browser.newPage();
    
    // Configura timeouts da página
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);

    // Configura o cabeçalho de idioma
    await page.setExtraHTTPHeaders({
      "Accept-Language": "pt-BR,pt;q=0.9",
    });

    // Gera a URL de pesquisa do Google Maps
    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;
    await page.goto(url, { waitUntil: "networkidle2" });

    console.log(`Pesquisando: ${searchTerm}`);

    // Seletor para os resultados
    const resultsSelector = `[aria-label="Resultados para ${searchTerm}"]`;
    await page.waitForSelector(resultsSelector, { timeout: 240000 }); // Aumenta o tempo limite para o carregamento

    // Rolar a página até carregar todos os resultados
    let previousHeight;
    while (true) {
      const resultDiv = await page.$(resultsSelector);
      previousHeight = await page.evaluate((el) => el.scrollHeight, resultDiv);
      await page.evaluate((el) => el.scrollBy(0, el.scrollHeight), resultDiv);
      await new Promise((resolve) => setTimeout(resolve, 6000)); // Aguarda 6 segundos entre as rolagens
      const newHeight = await page.evaluate((el) => el.scrollHeight, resultDiv);
      if (newHeight === previousHeight) break; // Sai do loop se não houver mais resultados
    }

    // Extrair os websites dos resultados
    const websites = await page.evaluate(() => {
      const elements = document.querySelectorAll('[data-value="Website"]');
      return Array.from(elements).map((el) => el.getAttribute("href"));
    });

    await browser.close();

    // Retorna os resultados como JSON
    return res.json({
      term: searchTerm,
      websites,
    });
  } catch (error) {
    console.error("Erro detalhado:", error);
    return res.status(500).json({ 
      error: "Erro ao realizar a pesquisa.",
      details: error.message,
      stack: error.stack 
    });
  }
});

// Adicione esta rota de healthcheck
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Inicializar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
