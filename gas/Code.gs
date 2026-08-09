  /**
  * Player Monetizado — CMS no Google Apps Script
  *

  */

  var PROP = {
    ADMIN_EMAIL: 'PM_ADMIN_EMAIL',
    ADMIN_PASSWORD: 'PM_ADMIN_PASSWORD',
    CONTENT_FILE_ID: 'PM_CONTENT_FILE_ID'
  };

  var DEFAULT_ADMIN = {
    email: 'contasafe31@gmail.com',
    password: '72938649174'
  };

  function doGet(e) {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || '';

    try {
      if (action === 'content') {
        return jsonOutput(getContent_(), params.callback);
      }

      if (action === 'health') {
        return jsonOutput({ ok: true, source: 'google-apps-script' }, params.callback);
      }
    } catch (err) {
      return jsonOutput({ error: String(err.message || err) }, params.callback);
    }

    return HtmlService.createTemplateFromFile('Admin')
      .evaluate()
      .setTitle('Admin | Player Monetizado')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  }

  /** Evita 405 se algum cliente enviar POST em vez de GET */
  function doPost(e) {
    return doGet(e);
  }

  function setupCms() {
    var props = PropertiesService.getScriptProperties();

    if (!props.getProperty(PROP.ADMIN_EMAIL)) {
      props.setProperty(PROP.ADMIN_EMAIL, DEFAULT_ADMIN.email);
    }
    if (!props.getProperty(PROP.ADMIN_PASSWORD)) {
      props.setProperty(PROP.ADMIN_PASSWORD, DEFAULT_ADMIN.password);
    }

    var fileId = props.getProperty(PROP.CONTENT_FILE_ID);
    var fileMissing = !fileId;
    if (!fileMissing) {
      try {
        DriveApp.getFileById(fileId);
      } catch (err) {
        fileMissing = true;
      }
    }
    if (fileMissing) {
      var initial = getSeedContent_();
      var file = DriveApp.createFile('player-monetizado-content.json', JSON.stringify(initial, null, 2), MimeType.PLAIN_TEXT);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      props.setProperty(PROP.CONTENT_FILE_ID, file.getId());
      fileId = file.getId();
    }

    var webAppUrl = ScriptApp.getService().getUrl() || null;

    return {
      ok: true,
      message: webAppUrl
        ? 'CMS configurado.'
        : 'CMS configurado. Próximo passo: Implantar > Nova implantação (App da Web).',
      contentFileId: fileId,
      webAppUrl: webAppUrl,
      publicContentUrl: webAppUrl ? webAppUrl + '?action=content' : null,
      adminEmail: props.getProperty(PROP.ADMIN_EMAIL)
    };
  }

  function loginAdmin(email, password) {
    setupCms();
    var props = PropertiesService.getScriptProperties();
    var expectedEmail = String(props.getProperty(PROP.ADMIN_EMAIL) || '').trim().toLowerCase();
    var expectedPassword = String(props.getProperty(PROP.ADMIN_PASSWORD) || '');

    if (String(email || '').trim().toLowerCase() !== expectedEmail || String(password || '') !== expectedPassword) {
      throw new Error('E-mail ou senha incorretos.');
    }

    var token = Utilities.getUuid();
    CacheService.getScriptCache().put('session:' + token, expectedEmail, 60 * 60 * 8);

    return {
      token: token,
      user: { email: expectedEmail, name: 'Mit Play' }
    };
  }

  function getAdminContent(token) {
    assertSession_(token);
    repairStoredContentIfNeeded_();
    return {
      content: getContent_(),
      publicContentUrl: getPublicContentUrl_(),
      webAppUrl: ScriptApp.getService().getUrl()
    };
  }

  function saveAdminContent(token, contentJson) {
    assertSession_(token);

    var parsed;
    try {
      parsed = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
    } catch (err) {
      throw new Error('JSON inválido. Confira vírgulas e aspas.');
    }

    var merged = mergeContent_(parsed);
    writeContent_(merged);
    return {
      ok: true,
      updatedAt: new Date().toISOString(),
      publicContentUrl: getPublicContentUrl_(),
      content: merged
    };
  }

  function restoreAdminContent(token) {
    assertSession_(token);
    var seed = getSeedContent_();
    writeContent_(seed);
    return {
      ok: true,
      updatedAt: new Date().toISOString(),
      publicContentUrl: getPublicContentUrl_(),
      content: seed
    };
  }

  function uploadAdminImage(token, base64Data, fileName, mimeType) {
    assertSession_(token);
    if (!base64Data) throw new Error('Arquivo inválido.');

    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType || 'image/png', fileName || 'upload.png');
    var folder = getUploadFolder_();
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      url: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
      path: file.getId()
    };
  }

  function getUploadFolder_() {
    var props = PropertiesService.getScriptProperties();
    var folderId = props.getProperty('PM_UPLOAD_FOLDER_ID');
    if (folderId) {
      try {
        return DriveApp.getFolderById(folderId);
      } catch (err) {
        /* recria */
      }
    }
    var folder = DriveApp.createFolder('player-monetizado-uploads');
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    props.setProperty('PM_UPLOAD_FOLDER_ID', folder.getId());
    return folder;
  }

  function getPublicContentUrl_() {
    var base = ScriptApp.getService().getUrl();
    return base ? base + '?action=content' : null;
  }

  function getContent_() {
    var merged = mergeContent_();
    repairTestimonialPhotos_(merged);
    return merged;
  }

  function readStoredContent_() {
    setupCms();
    var fileId = PropertiesService.getScriptProperties().getProperty(PROP.CONTENT_FILE_ID);
    var file = DriveApp.getFileById(fileId);
    try {
      return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    } catch (err) {
      throw new Error('Arquivo de conteúdo corrompido no Drive. Use "Restaurar conteúdo completo" no admin.');
    }
  }

  /** Mescla seed + Drive + edição para nunca perder seções (modules, offer, etc.) */
  function mergeContent_(patch) {
    var seed = getSeedContent_();
    var stored = readStoredContentSafe_();
    var merged = deepMerge_(seed, stored);
    return patch ? deepMerge_(merged, patch) : merged;
  }

  function readStoredContentSafe_() {
    try {
      return readStoredContent_();
    } catch (err) {
      return {};
    }
  }

  function deepMerge_(base, patch) {
    if (patch == null) return cloneValue_(base);
    if (base == null) return cloneValue_(patch);
    if (Array.isArray(base) || Array.isArray(patch)) {
      return Array.isArray(patch) ? cloneValue_(patch) : cloneValue_(base);
    }
    if (typeof base !== 'object' || typeof patch !== 'object') {
      return patch;
    }

    var result = cloneValue_(base);
    Object.keys(patch).forEach(function(key) {
      if (key === '__skipStored') return;
      if (
        patch[key] &&
        typeof patch[key] === 'object' &&
        !Array.isArray(patch[key]) &&
        result[key] &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge_(result[key], patch[key]);
      } else if (patch[key] !== undefined) {
        result[key] = cloneValue_(patch[key]);
      }
    });
    return result;
  }

  function cloneValue_(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(cloneValue_);
    var out = {};
    Object.keys(value).forEach(function(key) {
      out[key] = cloneValue_(value[key]);
    });
    return out;
  }

  function isDrivePhotoUrl_(url) {
    return String(url || '').indexOf('drive.google.com') !== -1;
  }

  function repairTestimonialPhotos_(content) {
    var seed = getSeedContent_();
    var seedItems = seed.testimonials && seed.testimonials.items;
    var items = content.testimonials && content.testimonials.items;
    if (!seedItems || !items) return false;

    var seedById = {};
    seedItems.forEach(function(item) {
      seedById[item.id] = item;
    });

    var changed = false;
    items.forEach(function(item) {
      var seedItem = seedById[item.id];
      if (!seedItem || !seedItem.photo || seedItem.photo.indexOf('assets/') !== 0) return;
      if (isDrivePhotoUrl_(item.photo)) {
        item.photo = seedItem.photo;
        changed = true;
      }
    });
    return changed;
  }

  function repairStoredContentIfNeeded_() {
    var stored = readStoredContentSafe_();
    var required = ['modules', 'instructor', 'testimonials', 'offer', 'buttons'];
    var incomplete = required.some(function(key) {
      return !stored[key];
    });
    var photosRepaired = repairTestimonialPhotos_(stored);
    if (incomplete || photosRepaired) {
      writeContent_(mergeContent_(photosRepaired ? stored : null));
    }
  }

  function writeContent_(data) {
    var props = PropertiesService.getScriptProperties();
    var fileId = props.getProperty(PROP.CONTENT_FILE_ID);
    if (!fileId) throw new Error('CMS não configurado. Rode setupCms no editor GAS.');
    var file = DriveApp.getFileById(fileId);
    var json = JSON.stringify(data, null, 2);
    file.setContent(json);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  function assertSession_(token) {
    if (!token) throw new Error('Sessão expirada. Entre novamente.');
    var email = CacheService.getScriptCache().get('session:' + token);
    if (!email) throw new Error('Sessão expirada. Entre novamente.');
  }

  function jsonOutput(data, callback) {
    var json = JSON.stringify(data);
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + json + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }

  function getSeedContent_() {
    return JSON.parse(INITIAL_CONTENT_JSON);
  }

  // @INITIAL_CONTENT_JSON_START
var INITIAL_CONTENT_JSON = "{\"general\":{\"courseName\":\"Player Monetizado\",\"logo\":\"assets/brand/mark.svg\",\"favicon\":\"assets/brand/favicon.svg\",\"siteOnline\":true,\"contactEmail\":\"playermonetizado@gmail.com\",\"contactPhone\":\"5511995791061\"},\"urgencyBar\":{\"badge\":\"Oferta de lançamento\",\"text\":\"Preço promocional de lançamento, vagas limitadas nesta turma\"},\"hero\":{\"badge\":\"O momento perfeito pra começar é agora\",\"titleLine1\":\"Transforme cortes de futebol\",\"titleAccent1\":\"futebol\",\"titleLine2\":\"em dólares ainda hoje\",\"titleAccent2\":\"dólares\",\"subtitle\":\"Aprenda a criar cortes virais e monetize seu canal de futebol no TikTok dedicando apenas 1 hora por dia, mesmo começando do zero.\",\"buttonText\":\"Quero começar agora\",\"buttonLink\":\"https://pay.kiwify.com.br/4Q3618c\",\"videoId\":\"vid-6a0911f9f38f377fba3e82ea\"},\"course\":{\"tag\":\"A solução\",\"title\":\"Programa Player Monetizado\",\"titleAccent\":\"Player Monetizado\",\"description\":\"O treinamento definitivo para transformar sua paixão pelo futebol em um canal de cortes que gera renda em dólares.\",\"extraText\":\"Condensei anos de testes com cortes virais de futebol em um roteiro que qualquer pessoa pode seguir, mesmo que você nunca tenha postado um corte na vida.\",\"highlightTitle\":\"O futebol não para\",\"highlightText\":\"Brasileirão, Libertadores, Champions, mercado da bola… Todo dia saem lances virais. Quem montar canal de cortes agora capta audiência o ano inteiro.\",\"items\":[\"Método passo a passo do zero ao avançado\",\"Cortes de alta retenção que dominam o algoritmo\",\"Monetização em dólares com múltiplas fontes de renda\",\"Apenas 1 hora por dia para montar e postar\"],\"ctaText\":\"Quero montar meu canal de cortes\"},\"modules\":{\"tag\":\"Conteúdo do curso\",\"title\":\"O que você vai aprender\",\"titleAccent\":\"aprender\",\"subtitle\":\"4 módulos completos para dominar canais de cortes de futebol\",\"items\":[{\"id\":\"1\",\"number\":\"01\",\"name\":\"Mineração de Conteúdo\",\"description\":\"Onde encontrar lances em 4K e 60fps sem marca d'água e como transformá-los em cortes prontos para viralizar.\",\"topics\":[\"Fontes premium de lances\",\"Setup de canal de cortes\",\"Nichagem em futebol\"]},{\"id\":\"2\",\"number\":\"02\",\"name\":\"Montagem de Cortes\",\"description\":\"Como montar cortes rápidos com gancho forte, legendas que prendem e o timing certo para viralizar no TikTok e Reels.\",\"topics\":[\"Ganchos de abertura\",\"Legendas dinâmicas\",\"Timing e ritmo viral\"]},{\"id\":\"3\",\"number\":\"03\",\"name\":\"Viralização de Cortes\",\"description\":\"O gancho de 3 segundos: como fazer o espectador assistir o corte até o final e compartilhar.\",\"topics\":[\"Ganchos de 3 segundos\",\"Retenção máxima\",\"Engajamento estratégico\"]},{\"id\":\"4\",\"number\":\"04\",\"name\":\"Monetização e Parcerias\",\"description\":\"Como monetizar seu canal de cortes com Fundo de Criadores, parcerias e afiliados.\",\"topics\":[\"Fundo de Criadores\",\"Parcerias estratégicas\",\"Monetização em dólares\"]}]},\"instructor\":{\"photo\":\"assets/edits/lucas-joao.png\",\"name\":\"Lucas João\",\"instagram\":\"@mitplay10\",\"instagramUrl\":\"https://instagram.com/mitplay10\",\"bio\":\"Criador do Player Monetizado e especialista em cortes de futebol de alta retenção para TikTok, Reels e Shorts.\",\"bioExtra\":\"Lucas condensou anos de testes com cortes virais de futebol em um método passo a passo, pensado para quem quer começar do zero, montar cortes pelo celular e monetizar com consistência.\",\"highlights\":[\"10+ anos criando conteúdo esportivo\",\"Método focado em canais de cortes virais\",\"Alunos monetizando com o Fundo de Criadores\",\"Suporte via comunidade VIP de Players\"]},\"testimonials\":{\"tag\":\"Depoimentos\",\"title\":\"O que nossos alunos dizem\",\"titleAccent\":\"dizem\",\"subtitle\":\"Criadores de cortes que já aplicaram o método\",\"disclaimer\":\"* Resultados variam conforme dedicação, nicho e plataforma. Depoimentos reais de alunos.\",\"items\":[{\"id\":\"1\",\"name\":\"Felipe Morais\",\"photo\":\"assets/testimonials/felipe.png\",\"tagline\":\"15 min por corte · 100% celular\",\"text\":\"Achei que precisava de PC, mas monto meus cortes pelo celular em 15 min.\",\"order\":0},{\"id\":\"2\",\"name\":\"Henrique Souza\",\"photo\":\"assets/testimonials/henrique.png\",\"tagline\":\"R$10K+/mês · Fundo de Criadores\",\"text\":\"Já estou faturando mais de R$10.000 por mês postando cortes de futebol!\",\"order\":1},{\"id\":\"3\",\"name\":\"Rafael Costa\",\"photo\":\"assets/testimonials/rafael.png\",\"tagline\":\"80K views · 14 dias\",\"text\":\"Em 2 semanas meu corte passou de 300 views para 80 mil. O gancho de 3 segundos mudou tudo.\",\"order\":2},{\"id\":\"4\",\"name\":\"Pedro Almeida\",\"photo\":\"assets/testimonials/pedro.png\",\"tagline\":\"Primeiro corte · 3 dias\",\"text\":\"Comecei do zero e no terceiro dia já tinha meu primeiro corte no ar. O passo a passo é muito claro.\",\"order\":3},{\"id\":\"5\",\"name\":\"Marcos Vieira\",\"photo\":\"assets/testimonials/marcos.png\",\"tagline\":\"52 anos · Canal novo\",\"text\":\"Achei que era tarde demais, mas em um mês meu canal já estava no Fundo de Criadores. Valeu cada centavo.\",\"order\":4},{\"id\":\"6\",\"name\":\"Lucas Tanaka\",\"photo\":\"assets/testimonials/lucas-tanaka.png\",\"tagline\":\"120K views · 1 corte\",\"text\":\"Postei um único corte seguindo o método e explodiu. Nunca imaginei que seria tão simples.\",\"order\":5}]},\"offer\":{\"tag\":\"Investimento\",\"title\":\"Quanto vale sua liberdade?\",\"subtitle\":\"Trabalhe de qualquer lugar postando cortes de futebol de um esporte que você já ama\",\"badge\":\"Oferta de lançamento\",\"productName\":\"Player Monetizado\",\"productSubtitle\":\"Acesso completo + todos os bônus\",\"oldPrice\":\"297\",\"currentPrice\":\"97,00\",\"installments\":\"12x de R$ 10,03\",\"stickyPrice\":\"12x de R$ 10,03\",\"discountPercent\":67,\"guaranteeDays\":7,\"guaranteeText\":\"Você tem 7 dias para testar o método. Se não aprender a criar cortes de alta retenção ou não gostar do conteúdo, devolvemos 100% do seu dinheiro. Sem perguntas.\",\"urgencyText\":\"Últimas vagas disponíveis nesta turma\",\"features\":[\"4 módulos completos de treinamento\",\"4 bônus exclusivos (R$ 528,90 de valor)\",\"Comunidade VIP de Players\",\"Atualizações gratuitas\",\"Acesso imediato e vitalício\",\"Garantia incondicional de 7 dias\"],\"bonuses\":[{\"id\":\"1\",\"value\":\"R$ 297,90\",\"title\":\"Crescimento Acelerado no YouTube\",\"description\":\"Treinamento completo para criar canal profissional do zero, monetizar rapidamente e viralizar com 10 anos de experiência condensados.\"},{\"id\":\"2\",\"value\":\"R$ 87,00\",\"title\":\"Pack de Overlays Premium\",\"description\":\"Raios, texturas e efeitos prontos para usar nos seus cortes.\"},{\"id\":\"3\",\"value\":\"R$ 47,00\",\"title\":\"Lista de Músicas Hype\",\"description\":\"As trilhas que estão em alta e não dão bloqueio de copyright.\"},{\"id\":\"4\",\"value\":\"R$ 97,00\",\"title\":\"Comunidade de Players\",\"description\":\"Acesso ao grupo VIP para networking, suporte e troca de estratégias.\"}],\"bonusSectionTitle\":\"Incluso no seu acesso\",\"bonusSectionSubtitle\":\"Materiais que, vendidos separadamente, ultrapassariam R$ 528,90\"},\"buttons\":{\"checkoutText\":\"Sim, quero gerar caixa rápido\",\"checkoutUrl\":\"https://pay.kiwify.com.br/4Q3618c\",\"buttonColor\":\"#10b981\",\"headerCtaText\":\"Garantir vaga\",\"stickyCtaText\":\"Comprar agora\",\"finalCtaText\":\"Garantir minha vaga agora\"},\"faq\":{\"tag\":\"Dúvidas\",\"title\":\"Perguntas frequentes\",\"titleAccent\":\"frequentes\",\"items\":[{\"id\":\"1\",\"question\":\"Preciso aparecer nos vídeos?\",\"answer\":\"Não. O método é 100% focado em canais de cortes de futebol sem aparecer. Você trabalha apenas com lances, montagem e postagem estratégica.\"},{\"id\":\"2\",\"question\":\"Consigo fazer apenas pelo celular?\",\"answer\":\"Sim. Todo o processo, da mineração de lances à montagem e postagem dos cortes, pode ser feito direto pelo celular.\"},{\"id\":\"3\",\"question\":\"Como recebo o acesso?\",\"answer\":\"Imediatamente no seu e-mail após a confirmação do pagamento. O acesso é instantâneo e vitalício.\"},{\"id\":\"4\",\"question\":\"Preciso saber editar vídeos?\",\"answer\":\"Não. O método foi criado para iniciantes absolutos. Você aprende a montar cortes do zero, passo a passo, mesmo que nunca tenha publicado um vídeo.\"},{\"id\":\"5\",\"question\":\"Quanto tempo por dia preciso dedicar?\",\"answer\":\"Apenas 1 hora por dia é suficiente para montar, postar e manter consistência no seu canal de cortes.\"},{\"id\":\"6\",\"question\":\"E se eu não gostar do curso?\",\"answer\":\"Você tem 7 dias de garantia incondicional. Se não gostar, basta solicitar o reembolso e devolvemos 100% do valor. Sem perguntas.\"}]},\"footer\":{\"tagline\":\"Transformando cortes de futebol em renda digital.\",\"copyright\":\"© 2026 Player Monetizado. Todos os direitos reservados.\",\"links\":[{\"id\":\"1\",\"label\":\"Política de Privacidade\",\"url\":\"politica-privacidade.html\"},{\"id\":\"2\",\"label\":\"Contato\",\"url\":\"contato.html\"},{\"id\":\"3\",\"label\":\"Termos de Uso\",\"url\":\"termos-de-uso.html\"}]},\"contact\":{\"pageTitle\":\"Contato\",\"lead\":\"Suporte para dúvidas sobre o curso, garantia, acesso ou parcerias.\",\"whatsapp\":{\"enabled\":true,\"phone\":\"5511995791061\",\"buttonText\":\"Chamar no WhatsApp\",\"message\":\"Olá! Tenho interesse em lucrar com cortes de futebol e quero saber mais sobre o Player Monetizado.\"},\"instagram\":{\"enabled\":true,\"handle\":\"@mitplay10\",\"url\":\"https://instagram.com/mitplay10\"}}}";
// @INITIAL_CONTENT_JSON_END
