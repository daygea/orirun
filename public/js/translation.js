/* ============================================================
 *  Orírùn — translation.js
 *
 *  Changes vs previous version:
 *  1. showPreloader/hidePreloader renamed to
 *     showTranslationLoader/hideTranslationLoader so they no
 *     longer overwrite main.js's preloader functions.
 *  2. translateWithCache uses relative path "/api/translate"
 *     instead of "${SERVER_URL}/api/translate" so config.js
 *     fetch override handles routing automatically.
 *  3. translatePage replaced with a batch version — all
 *     uncached texts are sent in ONE API call instead of one
 *     call per element. Repeat translations are instant from
 *     localStorage. Reduces translation time from 30–60 s
 *     to 2–5 s on first run, instant on repeat.
 * ============================================================ */

const LANGUAGES = {
    baseline: "Language",
    en:  "English",
    yo:  "Yoruba",
    ig:  "Igbo",
    ha:  "Hausa",
    sw:  "Swahili",
    fr:  "French",
    es:  "Spanish",
    pt:  "Portuguese",
    ht:  "Haitian Creole",
    fon: "Fon",
    ee:  "Eʋegbe",
    zu:  "Zulu",
    st:  "Sotho",
    sn:  "Shona",
    ny:  "Chichewa",
    rw:  "Kinyarwanda",
    am:  "Amharic",
    ar:  "Arabic",
    ln:  "Lingala",
    wo:  "Wolof",
    bm:  "Bambara",
};

const translations = {
  en: {
    language: "English", loading: "Loading...",
    guidance: [
      "Everything is connected and related, everything is ONE.",
      "Patience opens the path of wisdom.",
      "Your inner fire seeks balance, honor it.",
      "The ancestors guide your steps today.",
      "Even a small sacrifice clears the largest obstacle.",
      "Listen closely; silence also speaks truths.",
      "Every dawn brings hidden opportunities.",
      "Strength grows when shared with others.",
      "Respect the balance between giving and receiving.",
      "The river flows steadily, so must your journey.",
      "Trust that unseen hands prepare your way."
    ],
    header: "I pay homage to OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. I pay homage to all Elders.",
    divinationDetails: "Divination Details", oduIfa: "Odu Ifa",
    orientation: "Orientation (Ire / Ayewo)", specificOrientation: "Specific Orientation",
    solution: "Solution (Ebo / Adimu)", specificSolution: "Specific Solution",
    enterName: "Enter your full name", birthDate: "Select your birth date",
    revealMessage: "Reveal Message", or: "OR", pickNumber: "Pick a Number",
    support: "SUPPORT THE PROJECT",
    disclaimer: "Disclaimer: orirun.com is for informational and educational purposes only. It is not intended to replace professional advice or consultation.",
    terms: "Terms of Service & Privacy Policy", rights: "All Rights Reserved.",
    aboutUs: "About Us", sponsorship: "For more details on sponsorship and partnership, kindly call",
    contribute: "Contribute Content"
  },
  yo: {
    language: "Yorùbá", loading: "Wọ̀n ń bọ̀...",
    guidance: [
      "Gbogbo nkan ni asopọ ati ibatan; gbogbo nkan jẹ ọkan.",
      "Sùúrù ni baba ìwà.", "Iná inú rẹ fẹ́ ìdáná, bójú tó o.",
      "Àwọn bàbá ń tọ́ ọ lójú ọjọ́ yìí.", "Àbọrẹ kékeré lè yọ òpó ìdípa.",
      "Gbọ́ dáadáa, ìdákẹ́jẹ̀ náà ní ohun tó ń sọ.", "Gbogbo òwúrọ̀ mú àǹfààní tuntun wá.",
      "Agbára pọ̀ síi nígbà tí a bá pín.", "Dákẹ́ láàárín fífi àti gbígbà.",
      "Odò ń sàn lọ́wọ́ọ̀rọ̀, ìrìn rẹ gbọ́dọ̀ rọrùn.", "Gbẹ́kẹ̀ lé ọwọ́ àìrí tó ń ṣètò ọ̀nà rẹ."
    ],
    header: "Mo júbà OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Òlógboòjè, Ègàn, Gbogbo Ẹlẹ́yẹ, Gbogbo Irunmole, Ooni of Ife, Gbogbo Ọba Aláde, Àràbà Agbaye. Ìbá Gbogbo Ajunilọ.",
    divinationDetails: "Àlàyé Ìtẹ̀síwájú", oduIfa: "Odu Ifá",
    orientation: "Ìtọ́sọ́nà (Ìrẹ / Ayéwò)", specificOrientation: "Ìtọ́sọ́nà Pàtàkì",
    solution: "Ìdáhùn (Ẹbọ / Adìmú)", specificSolution: "Ìdáhùn Pàtàkì",
    enterName: "Tẹ orúkọ rẹ̀ kúnlẹ̀", birthDate: "Yan ọjọ́ ìbí rẹ",
    revealMessage: "Ṣí Ìfiranṣẹ́", or: "TÁBÍ", pickNumber: "Yan Nọ́mbà",
    support: "ṢÀTÍLẸ́YÌN FUN ÈTÒ YII",
    disclaimer: "Ìkìlọ̀: orirun.com jẹ́ fún ìmọ̀ àti ẹ̀kọ́ nìkan. Kì í ṣe ìròyìn tàbí ìmúlò láti rọ́pò ìmọ̀ràn ọjọ́gbọn.",
    terms: "Àwọn Òfin Ìṣe & Ìpamọ̀ Aládàáni", rights: "Gbogbo ẹ̀tọ́ tí a fipamọ́.",
    aboutUs: "Nípa Wa", sponsorship: "Fun alaye diẹ sii lori ìbámu àti ìfọwọ́sowọ́pọ̀, jọwọ pe",
    contribute: "Ṣe àfikún akoonu"
  },
  ig: {
    language: "Igbo", loading: "Na-ebudata...",
    guidance: [
      "Ihe niile jikọtara ma nwee njikọ; ihe niile bụ otu.",
      "Ndidi na-emeghe ụzọ amamihe.", "Ọkụ dị n'ime gị chọrọ ịdị n'otu.",
      "Ndị nna ochie na-edu ụzọ gị taa.", "Ọbọ dị ntakịrị nwere ike wepụ nnukwu ihe mgbochi.",
      "Gee ntị nke ọma; udo nwekwara okwu ya.", "Ụtụtụ ọ bụla na-eweta ohere ọhụrụ.",
      "Ike na-abawanye mgbe e kesara ya.", "Kwanyere ùgwù nguzozi n'etinye na inweta.",
      "Osimiri na-asọba nwayọọ, otú ahụ ka njem gị ga-adị.",
      "Kwere na aka na-apụghị ịhụ anya na-edozi ụzọ gị."
    ],
    header: "Anyị na-asọpụrụ CHUKWU OKIKE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Anyị na-akpọ ha niile ka ha na-efe anyị ụzọ ọma.",
    divinationDetails: "Nkọwa Amụma", oduIfa: "Odu Ifa",
    orientation: "Ndụzi (Ire / Nyocha)", specificOrientation: "Ndụzi pụrụ iche",
    solution: "Ngwọta (Àjà / Ọrụ)", specificSolution: "Ngwọta pụrụ iche",
    enterName: "Tinye aha gị zuru ezu", birthDate: "Họrọ ụbọchị ọmụmụ gị",
    revealMessage: "Gosi Ozi", or: "MA Ọ BỤ", pickNumber: "Họrọ Nọmba",
    support: "KWADO ỌRỤ A",
    disclaimer: "Ndụmọdụ: orirun.com bụ maka ọmụmụ na ọmụmụ ihe naanị. Ọ bụghị ihe ga-anọchi ndụmọdụ ma ọ bụ nkwado ndị ọkachamara.",
    terms: "Usoro Ọrụ & Nzuzo", rights: "Ikikere niile echekwara.",
    aboutUs: "Banyere Anyị", sponsorship: "Maka nkọwa ndị ọzọ gbasara nkwado na mmekọrịta, biko kpọọ",
    contribute: "Tinye aka na ọdịnaya"
  },
  ha: {
    language: "Hausa", loading: "Ana ɗora...",
    guidance: [
      "Komai yana da alaƙa da haɗin kai; komai abu ɗaya ne.",
      "Haƙuri yana buɗe hanyar hikima.", "Wutar cikin ka tana neman daidaito, girmama ta.",
      "Kakanni suna jagorantar matakinka yau.", "Ƙaramin sadaka na iya kawar da babban cikas.",
      "Saurara sosai; shiru ma yana magana.", "Kowane safe yana kawo sabbin damar.",
      "Ƙarfi yana ƙaruwa idan an raba shi.", "Ka girmama daidaito tsakanin bayarwa da karɓa.",
      "Kogin yana gudana a hankali, haka tafiyarka ya kamata.",
      "Ka yarda cewa hannaye marasa ganuwa suna shirya maka hanya."
    ],
    header: "Ina girmama OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni na Ife, Gbogbo Oba Alade, da Araba Agbaye. Ina girmama dukkan dattawa.",
    divinationDetails: "Cikakken Bayani", oduIfa: "Odu Ifa",
    orientation: "Jagora (Alheri / Gwaji)", specificOrientation: "Jagora na Musamman",
    solution: "Magani (Hadaya / Aiki)", specificSolution: "Magani na Musamman",
    enterName: "Shigar da cikakken sunanka", birthDate: "Zaɓi ranar haihuwarka",
    revealMessage: "Bayyana Saƙo", or: "KO", pickNumber: "Zaɓi Lamba",
    support: "GOYON BAYAN SHIRI",
    disclaimer: "Bayani: orirun.com don ilimi da bayani kawai. Ba ya maye gurbin shawarar ko taimakon kwararru.",
    terms: "Ka'idojin Sabis & Sirri", rights: "Dukkan haƙƙoƙi an kiyaye su.",
    aboutUs: "Game da Mu", sponsorship: "Don ƙarin bayani game da tallafi da haɗin gwiwa, da fatan za a kira",
    contribute: "Ba da gudummawar abun ciki"
  },
  sw: {
    language: "Swahili", loading: "Inapakia...",
    guidance: [
      "Kila kitu kimeunganishwa na kina uhusiano; kila kitu ni kimoja.",
      "Subira hufungua njia ya hekima.", "Moto wa ndani unatafuta usawa, heshimu hilo.",
      "Wazee wa jadi wanakuongoza leo.", "Hata sadaka ndogo huondoa kizuizi kikubwa.",
      "Sikiliza kwa makini; kimya pia husema.", "Kila alfajiri huleta fursa mpya.",
      "Nguvu huongezeka inaposhirikishwa.", "Heshimu usawa kati ya kutoa na kupokea.",
      "Mto unasonga taratibu, safari yako iwe hivyo pia.",
      "Amini kwamba mikono isiyoonekana inatayarisha njia yako."
    ],
    header: "Ninamtolea heshima OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Heshima kwa Ajunilo wote.",
    divinationDetails: "Maelezo ya Utabiri", oduIfa: "Odu Ifa",
    orientation: "Mwelekeo (Ire / Ayewo)", specificOrientation: "Mwelekeo Mahususi",
    solution: "Suluhisho (Ebo / Adimu)", specificSolution: "Suluhisho Mahususi",
    enterName: "Ingiza jina lako kamili", birthDate: "Chagua tarehe yako ya kuzaliwa",
    revealMessage: "Onyesha Ujumbe", or: "AU", pickNumber: "Chagua Nambari",
    support: "SAIDIA MRADI",
    disclaimer: "Kanusho: orirun.com ni kwa madhumuni ya taarifa na elimu pekee. Haikusudiwi kuchukua nafasi ya ushauri wa kitaalamu au mashauriano.",
    terms: "Masharti ya Huduma & Sera ya Faragha", rights: "Haki Zote Zimehifadhiwa.",
    aboutUs: "Kuhusu Sisi", sponsorship: "Kwa maelezo zaidi kuhusu udhamini na ushirikiano, tafadhali piga",
    contribute: "Changia maudhui"
  },
  fr: {
    language: "Français", loading: "Chargement...",
    guidance: [
      "Tout est connecté et lié, tout est UN.", "La patience ouvre le chemin de la sagesse.",
      "Votre feu intérieur cherche l'équilibre, honorez-le.",
      "Les ancêtres guident vos pas aujourd'hui.", "Même un petit sacrifice enlève le plus grand obstacle.",
      "Écoutez bien ; le silence parle aussi.", "Chaque matin apporte de nouvelles opportunités.",
      "La force grandit quand elle est partagée.", "Respectez l'équilibre entre donner et recevoir.",
      "Comme la rivière qui coule, avancez sans hâte.",
      "Faites confiance aux mains invisibles qui préparent votre voie."
    ],
    header: "Je rends hommage à OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Hommage à tous les Ajunilo.",
    divinationDetails: "Détails de la Divination", oduIfa: "Odu Ifa",
    orientation: "Orientation (Ire / Ayewo)", specificOrientation: "Orientation Spécifique",
    solution: "Solution (Ebo / Adimu)", specificSolution: "Solution Spécifique",
    enterName: "Entrez votre nom complet", birthDate: "Sélectionnez votre date de naissance",
    revealMessage: "Révéler le Message", or: "OU", pickNumber: "Choisissez un Nombre",
    support: "SOUTENIR LE PROJET",
    disclaimer: "Avertissement : orirun.com est uniquement à des fins d'information et d'éducation. Il n'est pas destiné à remplacer un avis professionnel ou une consultation.",
    terms: "Conditions d'Utilisation & Politique de Confidentialité", rights: "Tous droits réservés.",
    aboutUs: "À propos de nous", sponsorship: "Pour plus de détails sur le parrainage et le partenariat, veuillez appeler le",
    contribute: "Contribuer au contenu"
  },
  es: {
    language: "Español", loading: "Cargando...",
    guidance: [
      "Todo está conectado y relacionado, todo es UNO.", "La paciencia abre el camino de la sabiduría.",
      "Tu fuego interior busca equilibrio, hónralo.", "Los ancestros guían tus pasos hoy.",
      "Incluso un pequeño sacrificio elimina el mayor obstáculo.",
      "Escucha con atención; el silencio también habla.", "Cada amanecer trae nuevas oportunidades.",
      "La fuerza crece cuando se comparte.", "Respeta el equilibrio entre dar y recibir.",
      "El río fluye constante, así debe ser tu viaje.",
      "Confía en que manos invisibles preparan tu camino."
    ],
    header: "Rindo homenaje a OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Homenaje a todos los Ajunilo.",
    divinationDetails: "Detalles de la Adivinación", oduIfa: "Odu Ifa",
    orientation: "Orientación (Ire / Ayewo)", specificOrientation: "Orientación Específica",
    solution: "Solución (Ebo / Adimu)", specificSolution: "Solución Específica",
    enterName: "Ingrese su nombre completo", birthDate: "Seleccione su fecha de nacimiento",
    revealMessage: "Revelar Mensaje", or: "O", pickNumber: "Elige un Número",
    support: "APOYA EL PROYECTO",
    disclaimer: "Aviso: orirun.com es solo para fines informativos y educativos. No está destinado a reemplazar el consejo profesional o la consulta.",
    terms: "Términos de Servicio y Política de Privacidad", rights: "Todos los derechos reservados.",
    aboutUs: "Sobre Nosotros", sponsorship: "Para más detalles sobre patrocinio y asociación, por favor llame al",
    contribute: "Contribuir contenido"
  },
  pt: {
    language: "Português", loading: "Carregando...",
    guidance: [
      "Tudo está conectado e relacionado, tudo é UM.", "A paciência abre o caminho da sabedoria.",
      "Seu fogo interior busca equilíbrio, honre-o.", "Os ancestrais guiam seus passos hoje.",
      "Mesmo um pequeno sacrifício remove o maior obstáculo.",
      "Ouça atentamente; o silêncio também fala.", "Cada amanhecer traz novas oportunidades.",
      "A força cresce quando é compartilhada.", "Respeite o equilíbrio entre dar e receber.",
      "O rio flui constantemente, assim deve ser sua jornada.",
      "Confie que mãos invisíveis preparam seu caminho."
    ],
    header: "Rendo homenagem a OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Homenagem a todos os Ajunilo.",
    divinationDetails: "Detalhes da Adivinhação", oduIfa: "Odu Ifa",
    orientation: "Orientação (Ire / Ayewo)", specificOrientation: "Orientação Específica",
    solution: "Solução (Ebo / Adimu)", specificSolution: "Solução Específica",
    enterName: "Digite seu nome completo", birthDate: "Selecione sua data de nascimento",
    revealMessage: "Revelar Mensagem", or: "OU", pickNumber: "Escolha um Número",
    support: "APOIE O PROJETO",
    disclaimer: "Aviso: orirun.com é apenas para fins informativos e educacionais. Não se destina a substituir aconselhamento ou consulta profissional.",
    terms: "Termos de Serviço & Política de Privacidade", rights: "Todos os direitos reservados.",
    aboutUs: "Sobre Nós", sponsorship: "Para mais detalhes sobre patrocínio e parceria, por favor ligue para",
    contribute: "Contribuir com conteúdo"
  },
  ht: {
    language: "Kreyòl Ayisyen", loading: "Chajman...",
    guidance: [
      "Tout bagay konekte epi gen rapò; tout bagay se YONN.", "Pasyans louvri chemen sajès.",
      "Dife ki nanm ou chèche balans, onore li.", "Zansèt yo ap gide w jodi a.",
      "Menm yon ti sakrifis ka wete pi gwo obstak.", "Koute byen; silans pale tou.",
      "Chak maten pote nouvo opòtinite.", "Fòs la grandi lè yo pataje l.",
      "Respèkte balans lan ant bay ak resevwa.", "Rivyè a koule dousman, konsa vwayaj ou dwe ye.",
      "Kwè ke men envizib ap prepare wout ou."
    ],
    header: "Mwen rann omaj pou OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Omaj pou tout Ajunilo.",
    divinationDetails: "Detay Divinasyon", oduIfa: "Odu Ifa",
    orientation: "Orientasyon (Ire / Ayewo)", specificOrientation: "Orientasyon Espesifik",
    solution: "Solisyon (Ebo / Adimu)", specificSolution: "Solisyon Espesifik",
    enterName: "Antre non konplè ou", birthDate: "Chwazi dat nesans ou",
    revealMessage: "Revele Mesaj", or: "OSWA", pickNumber: "Chwazi yon Nimewo",
    support: "SIPÒTE PROJÈ A",
    disclaimer: "Deklarasyon: orirun.com se sèlman pou enfòmasyon ak edikasyon. Li pa fèt pou ranplase konsèy pwofesyonèl oswa konsiltasyon.",
    terms: "Tèm Sèvis & Règleman sou Konfidansyalite", rights: "Tout dwa rezève.",
    aboutUs: "Sou Nou", sponsorship: "Pou plis detay sou patwone ak patenarya, tanpri rele",
    contribute: "Kontribye kontni"
  },
  fon: {
    language: "Fon", loading: "Nɔ wɛ ɖe...",
    guidance: [
      "Nú gbogbo wɛ̀ nu do do; gbogbo wɛ̀ nu ɖé ɖokpo.", "Sinsin yɛ kpɔ̀ yì amɛ su nú.",
      "Aflí nú wémɛ ɖo, yi vɔ̃.", "Tɔgbuiwo nà lɛ nú kpɔ̀ lɛ.", "Xó àdodo mé kpɔ̀ gbè àgbé.",
      "Mɛkplɔ gbè, mɛ nyi kɛ̀nú.", "Gbã nùkpɔ̀ji nyi kpɔ̀ gbè vɔ̃.",
      "Súsu nà ɖo nù gbè vɔ̃.", "Wɛ kpɔ̀ tɔ̃ gbè bɔ̀ gbɔ̀.",
      "Ʋu nà mè nú ɖò, yi lɛ kpɔ̀ gbè.", "Zɔsi gùnkpɔnkpɔn lè nù kpɔ̀ gbè lɛ."
    ],
    header: "Mɛ na do kpɔ́ OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Do kpɔ́ Ajunilo lɛ gbɔ.",
    divinationDetails: "Nuxɔnu si le Wémɛ", oduIfa: "Odu Ifa",
    orientation: "ɖokui (Ire / Ayewo)", specificOrientation: "ɖokui si ɖe ɖevi",
    solution: "Nuxɔnu (Ebo / Adimu)", specificSolution: "Nuxɔnu si ɖe ɖevi",
    enterName: "Ɖe wo ƒe ŋkɔkɔ blibo", birthDate: "Tia wo ƒe dzedzedze ƒe ŋkeke",
    revealMessage: "Wɔ Aƒe", or: "ANA", pickNumber: "Tia Ɖeka", support: "Dɔwɔ ƒe Dɔwɔnu",
    disclaimer: "Gbɔgbɔ: orirun.com nye ɖe gbɔgbɔ kple dzidzɔɖoawo gɔme ŋu. Mègblɔe be mɛate ŋu akpɔ anyiɖoɖo gbãtɔ dzi o.",
    terms: "Gbɔgbɔtɔwo ƒe Nyadzɔdzɔ & Tsitrele ƒe Nyadzɔdzɔ", rights: "Dodo ɖe ɖe wɛwɛ lɛ nyi.",
    aboutUs: "Ŋù wɛ nú wɛ", sponsorship: "Tɔ́n gbɛna ɖo hɛn ná nú wɔ́ɖo wémɛ kplé àkɔnta, ɖo hɛn xɔ",
    contribute: "Sɔ́ akɔ́nù xɔ́"
  },
  ee: {
    language: "Eʋegbe", loading: "Le wòlé...",
    guidance: [
      "Nu katã wòwòa le ɖokui me eye wòwòa do ŋgɔ; nu katã nye ɖeka.",
      "Agbeɔ̃na tsɔ kple dɔwɔnu.", "Ŋutsu ŋuƒo kple ŋuɖo le wòƒe dzɔdzɔ me.",
      "Tɔgbuiwo katã nà wò ŋu le egbe sia.", "Aƒe kple si dze le ƒe me wòle gbɔ.",
      "Trɔ gbɔgbɔ be; ŋkeke me kple gbe.", "Dzidzɔ ƒe ŋkeke sia nà kpɔ nusi titina.",
      "Gbedodo katã nà dze le nutoƒe nyateƒe.", "Fia ɖo dɔwɔnu kple nutoƒe gbɔdzɔ.",
      "Tsike la katã kple wòƒe dzidzɔwo.", "Gblɔe be ame gbɔgbɔ ŋutɔwo le wò dɔmedzo."
    ],
    header: "Metsɔ kɔkɔe na OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Metsɔ kɔkɔe na Ajuniloawo katã.",
    divinationDetails: "Nyatakakadzraɖo ƒe Agbalẽ", oduIfa: "Odu Ifa",
    orientation: "Ɖoɖo (Ire / Ayewo)", specificOrientation: "Ɖoɖo Mawoe",
    solution: "Agbalẽ (Ebo / Adimu)", specificSolution: "Agbalẽ Mawoe",
    enterName: "Ɖe wo ŋkɔkɔ katã", birthDate: "Tia wo dzedzedze ƒe ŋkeke",
    revealMessage: "Wɔ Nyatakakadzraɖo", or: "KE", pickNumber: "Tia Xexeme",
    support: "DZRA ƉO ƉO NA AGBALÉ",
    disclaimer: "Agbalẽ: orirun.com nye ɖe nyatakakadzraɖo kple dzidzɔɖoawo ŋu. Mègblɔe be mɛate ŋu anɔ anyiɖoɖo gbãtɔ dzi o.",
    terms: "Agbalẽ ƒe Nyadzɔdzɔwo & Tsitrele ƒe Nyadzɔdzɔ", rights: "Agbalẽwo katã wɔm na ameawo ŋutɔ.",
    aboutUs: "Mìele ƒe nyateƒe", sponsorship: "Ne nyateƒe bubu kple dzidzɔwo me na dzidzɔ kple nɔnudɔ, mekpɔe be nàƒo",
    contribute: "Tsɔ emenyawo kpe"
  },
  zu: {
    language: "Zulu", loading: "Iyalayisha...",
    guidance: [
      "Konke kuxhumene futhi kuhlobene; konke kuyinto eyodwa.",
      "Ukubekezela kuvula indlela yokuhlakanipha.",
      "Umlilo wakho wangaphakathi ufuna ibhalansi — muhloniphe.",
      "Okhokho bakho bakuqondisa namuhla.", "Nomhlatshelo omncane ungakususa esithiyweni esikhulu.",
      "Lalela ngokucophelela; nokuthula kukhuluma iqiniso.",
      "Ukuphuma kokusa kuletha amathuba afihlekile.", "Amandla akhula uma ehlanganyelwa nabanye.",
      "Hlonipha ibhalansi phakathi kokupha nokwamukela.",
      "Umuzi ugobhoza kancane — kanjalo nohambo lwakho.",
      "Themba ukuthi izandla ezingabonakali zilungiselela indlela yakho."
    ],
    header: "Ngiyakhothamela u-OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni wase-Ife, Gbogbo Oba Alade, Araba Agbaye. Ngiyakhothamela bonke abadala.",
    divinationDetails: "Imininingwane Yokubhula", oduIfa: "Odu Ifa",
    orientation: "Ukuhleleka (Ire / Ayewo)", specificOrientation: "Ukuhleleka Okuthile",
    solution: "Isixazululo (Ebo / Adimu)", specificSolution: "Isixazululo Esithile",
    enterName: "Faka igama lakho eliphelele", birthDate: "Khetha usuku lokuzalwa kwakho",
    revealMessage: "Veza Umlayezo", or: "NOMA", pickNumber: "Khetha Inombolo",
    support: "SEKELA UMCWANINGO",
    disclaimer: "Isaziso: orirun.com yenzelwe ulwazi nokufundisa kuphela. Akufanele ithathe indawo yeseluleko sobungcweti noma ukwelulekwa.",
    terms: "Imigomo Yesevisi & Inqubomgomo Yobumfihlo", rights: "Wonke Amalungelo Agodliwe.",
    aboutUs: "Mayelana Nathi", sponsorship: "Ngemininingwane eminingi yokuxhaswa noma ukubambisana, sicela ushaye ucingo ku-",
    contribute: "Nikela okuqukethwe"
  },
  st: {
    language: "Sotho", loading: "E jarisa...",
    guidance: [
      "Lintho tsohle li hokahane ebile lia amana; tsohle ke ntho e le 'ngoe.",
      "Mamello e bula tsela ea bohlale.", "Mollo oa hao oa kahare o batla tekano — o hlomphe.",
      "Baholo-holo ba hao baa u tataisa kajeno.", "Le nyehelo e nyenyane e ka tlosa tšitiso e kholo.",
      "Mamela ka hloko; le khutso e bua 'nete.", "Hoseng ho hong le ho hong ho tlisa menyetla e patiloeng.",
      "Matla a hola ha a arolelanoa le ba bang.", "Hlomphela tekano pakeng tsa ho fana le ho amohela.",
      "Noka e phalla butle-butle — joalo le leeto la hao.",
      "Ts'epa hore matsoho a sa bonahaleng a lokisetsa tsela ea hao."
    ],
    header: "Ke inamela OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni oa Ife, Gbogbo Oba Alade, Araba Agbaye. Ke inamela bohle ba baholo.",
    divinationDetails: "Lintlha tsa Phatlalatso ea Ifa", oduIfa: "Odu Ifa",
    orientation: "Boemo (Ire / Ayewo)", specificOrientation: "Boemo bo Khethiloeng",
    solution: "Tharollo (Ebo / Adimu)", specificSolution: "Tharollo e Khethiloeng",
    enterName: "Kenya lebitso la hao le felletseng", birthDate: "Khetha letsatsi la tsoalo ea hao",
    revealMessage: "Bontša Molaetsa", or: "KAPA", pickNumber: "Khetha Nomoro",
    support: "TS'EHETSA MORERO",
    disclaimer: "Tlhokomeliso: orirun.com e etselitsoe tsebo le thuto feela. Ha e reretsoe ho nka sebaka sa keletso ea setsebi kapa puisano.",
    terms: "Lipehelo tsa Ts'ebeletso & Leano la Lekunutu", rights: "Litokelo Tsohle li Sirelelitsoe.",
    aboutUs: "Ka Rona", sponsorship: "Bakeng sa lintlha tse ling tsa ts'ehetso kapa tšebelisano, ka kopo letsetsa ho-",
    contribute: "Nehela litaba"
  },
  sn: {
    language: "Shona", loading: "Kuri kutakura...",
    guidance: [
      "Zvese zvakabatana uye zvine hukama; zvese chinhu chimwe chete.",
      "Kushivirira kunovhura nzira yeruzivo.", "Moto wemukati mako unoda kuenzaniswa — uuremekedze.",
      "Madzitateguru ako ari kukutungamira nhasi.",
      "Kunyangwe chipo chidiki chinogona kubvisa chingamupinyi chikuru.",
      "Teerera zvakanaka; kunyarara kunotaurawo chokwadi.",
      "Mangwanani oga oga anounza mikana yakavanzika.", "Simba rinokura kana richigovaniswa nevamwe.",
      "Ramba uchiremekedza kuenzana pakati pekupa nekuwana.",
      "Rwizi runoyerera zvishoma nezvishoma — saizvozvowo rwendo rwako.",
      "Vimba kuti maoko asingaonekwi ari kugadzirira nzira yako."
    ],
    header: "Ndinopa rukudzo kuna OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni we Ife, Gbogbo Oba Alade, Araba Agbaye. Ndinopa rukudzo kune vakuru vose.",
    divinationDetails: "Zvakadzama zveKuparidza Ifa", oduIfa: "Odu Ifa",
    orientation: "Kuratidzwa (Ire / Ayewo)", specificOrientation: "Kuratidzwa Kwakatarwa",
    solution: "Mhinduro (Ebo / Adimu)", specificSolution: "Mhinduro Yakatarwa",
    enterName: "Isa zita rako rizere", birthDate: "Sarudza zuva rekuberekwa kwako",
    revealMessage: "Ratidza Mharidzo", or: "KANA", pickNumber: "Sarudza Nhamba",
    support: "TSIGIRA PROJEKITI",
    disclaimer: "Chiziviso: orirun.com ndechekupa ruzivo nekudzidzisa chete. Hachisi kutsiva zano kana kurairwa kwehunyanzvi.",
    terms: "Mitemo yeBasa & Mutemo weKuvanzika", rights: "Kodzero Dzose Dzakarondedzerwa.",
    aboutUs: "Nezvedu", sponsorship: "Kuti uwane rumwe ruzivo pamusoro petsigiro kana kubatana, ndapota dana pa-",
    contribute: "Pira zvemukati"
  },
  ny: {
    language: "Chichewa", loading: "Kukweza...",
    guidance: [
      "Zinthu zonse zimagwirizana ndi kulumikizana; zonse ndi chimodzi.",
      "Kuleza mtima kumatsegula njira ya nzeru.", "Moto womwe uli mkati mwako ukufuna kufanana — ulemekeze.",
      "Makolo akale akukutsogolerani lero.", "Ngakhale nsembe yaying'ono imachotsa chotchinga chachikulu.",
      "Mvetserani mosamala; kusalankhula kumanenanso chowonadi.",
      "M'mawa uliwonse umabweretsa mwayi watsopano wobisika.", "Mphamvu imakula ikamagawidwa ndi ena.",
      "Lemekezani kusalinganiza pakati popereka ndi kulandira.",
      "Mtsinje umasunthira pang'onopang'ono — choncho uyeneranso ulendo wanu.",
      "Khalani ndi chikhulupiriro kuti manja osawoneka akukonzekerani njira yanu."
    ],
    header: "Ndikupereka ulemu kwa OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni wa Ife, Gbogbo Oba Alade, Araba Agbaye. Ndikupereka ulemu kwa akulu onse.",
    divinationDetails: "Tsatanetsatane wa Kulosera kwa Ifa", oduIfa: "Odu Ifa",
    orientation: "Kuwongolera (Ire / Ayewo)", specificOrientation: "Kuwongolera Kwapadera",
    solution: "Yankho (Ebo / Adimu)", specificSolution: "Yankho Lapadera",
    enterName: "Lowetsani dzina lanu lonse", birthDate: "Sankhani tsiku lobadwa",
    revealMessage: "Onetsani Uthenga", or: "KAPENA", pickNumber: "Sankhani Nambala",
    support: "THANDIZANI NTCHITOYI",
    disclaimer: "Chenjezo: orirun.com ndi ya chidziwitso ndi maphunziro okha. Sikulowa m'malo mwa upangiri kapena chitsogozo cha akatswiri.",
    terms: "Mfundo za Ntchito & Ndondomeko ya Chinsinsi", rights: "Ufulu Onse Ndi Otetezedwa.",
    aboutUs: "Za Ife", sponsorship: "Kuti mudziwe zambiri zokhudza kuthandizana kapena mgwirizano, imbani pa-",
    contribute: "Thandizani zomwe zili"
  },
  rw: {
    language: "Kinyarwanda", loading: "Irimo gutangira...",
    guidance: [
      "Ibintu byose bifitanye isano kandi birahujwe; byose ni kimwe.",
      "Kwihangana bifungura inzira y'ubwenge.", "Umuti ukwiye hagati y'umuriro uri muri wowe — uwubahirize.",
      "Abakurambere bakuyobora uyu munsi.", "N'igitambo gito gishobora gukuraho inzitizi nini.",
      "Tega amatwi neza; no gutuza nabyo bivuga ukuri.", "Buri bukeye butanga amahirwe mashya yihishe.",
      "Imbaraga ziyongera iyo zisangiwe n'abandi.", "Icyubahiro kiri hagati yo gutanga no kwakira.",
      "Umugezi utemba gahoro — uko ni ko urugendo rwawe rugomba kuba.",
      "Izuba riri imbere — wizere ko imbaraga zidasanzwe ziri kukuyobora."
    ],
    header: "Ndagira ngo nshimire OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni wa Ife, Gbogbo Oba Alade, Araba Agbaye. Nshimiye kandi Abakuru bose.",
    divinationDetails: "Ibisobanuro by'Iturufu ya Ifa", oduIfa: "Odu Ifa",
    orientation: "Icyerekezo (Ire / Ayewo)", specificOrientation: "Icyerekezo Cyihariye",
    solution: "Igisubizo (Ebo / Adimu)", specificSolution: "Igisubizo Cyihariye",
    enterName: "Andika izina ryawe ryose", birthDate: "Hitamo itariki y'amavuko",
    revealMessage: "Erekana Ubutumwa", or: "CYANGWA", pickNumber: "Hitamo Umubare",
    support: "SHYIGIKIRA UMWANYA WA ORIRUN",
    disclaimer: "Itangazo: orirun.com ni urubuga rw'amakuru n'uburezi gusa. Ntabwo rigamije gusimbura inama cyangwa ubujyanama bw'ababigize umwuga.",
    terms: "Amategeko y'Imikoreshereze & Politiki y'Ibyerekeye Amabanga", rights: "Uburenganzira bwose burabitswe.",
    aboutUs: "Ibyerekeye Twebwe", sponsorship: "Kugira ngo umenye byinshi ku bufatanye cyangwa ubufasha, hamagara kuri-",
    contribute: "Tanga umusanzu ku bikubiyemo"
  },
  am: {
    language: "Amharic", loading: "በመጫን ላይ...",
    guidance: [
      "ሁሉም ነገር ተያይዞ እና ተገናኝቷል፤ ሁሉም ነገር አንድ ነው።", "ትዕግስት የጥበብ መንገድን ይከፍታል።",
      "ውስጥህ ያለው እሳት መጋረጃ ይፈልጋል፤ አክብረው።", "አያቶቻችን ዛሬ እየመሩህ ናቸው።",
      "ትንሽ መሥዋዕት ትልቅ መከራን ሊያስወግድ ይችላል።", "ጥሩ ትኩረት ስጥ፤ ዝምታም እውነታዎችን ይናገራል።",
      "የእያንዳንዱ ንጋት የተደበቁ እድሎችን ያመጣል።", "ኃይል ሲጋራ እየተጋራ ይድጋል።",
      "መልካምነት በመስጠትና በመቀበል መካከል ይገኛል።", "ወንዝ በትክክል ይፈሳል፤ እንዲሁም ጉዞህ መሆን አለበት።",
      "በማይታይ እጆች መንገድህን እንዲያዘጋጁ ታመን።"
    ],
    header: "እኔ ኦሎዱማሬ፣ አጃጉንማሌ፣ አዎኖማጃ፣ ኦዱ ኦሎግቦጀ፣ ኤጋን፣ ግቦጎ ኤሌዬ፣ ኦዱዱዋ፣ ኦኒ ኦፍ ኢፌ፣ ግቦጎ ኦባ አላዴ፣ አራባ አጋባዬን አመሰግናለሁ። እንዲሁም ለአያቶቻችን ሁሉ ክብር እናደርጋለን።",
    divinationDetails: "የኢፋ ትንቢት ዝርዝሮች", oduIfa: "ኦዱ ኢፋ",
    orientation: "አቅጣጫ (Ire / Ayewo)", specificOrientation: "የተወሰነ አቅጣጫ",
    solution: "መፍትሔ (Ebo / Adimu)", specificSolution: "የተወሰነ መፍትሔ",
    enterName: "ሙሉ ስምህን አስገባ", birthDate: "የትውልድ ቀንህን ምረጥ",
    revealMessage: "መልዕክቱን አሳይ", or: "ወይም", pickNumber: "ቁጥር ምረጥ",
    support: "የORIRUN ፕሮጀክትን ድጋፍ አድርግ",
    disclaimer: "መግለጫ፡ orirun.com ለመረጃ እና ለትምህርት ዓላማ ብቻ ነው። ይህ የሙያ ምክር ወይም አግድ ምክርን ለመተካት አይታሰብም።",
    terms: "የአጠቃቀም ደንቦች እና የግላዊነት ፖሊሲ", rights: "መብቶች ሁሉ የተጠበቁ ናቸው።",
    aboutUs: "ስለ እኛ", sponsorship: "ስለ ድጋፍ ወይም ተባባሪነት ዝርዝሮች ለበለጠ መረጃ፣ በመስመር ላይ ይደውሉ -",
    contribute: "ይዘት ያበርክቱ"
  },
  ar: {
    language: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
    loading: "\u062C\u0627\u0631\u0650 \u0627\u0644\u062A\u062D\u0645\u064A\u0644...",
    guidance: [
      "\u0643\u0644 \u0634\u064A\u0621 \u0645\u062A\u0631\u0627\u0628\u0637 \u0648\u0645\u062A\u0635\u0650\u0644\u060C \u0643\u0644 \u0634\u064A\u0621 \u0648\u0627\u062D\u062F.",
      "\u0627\u0644\u0635\u0628\u0631 \u064A\u0641\u062A\u062D \u0637\u0631\u064A\u0642 \u0627\u0644\u062D\u0643\u0645\u0629.",
      "\u0646\u064A\u0631\u0627\u0646\u0643 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u062A\u0628\u062D\u062B \u0639\u0646 \u0627\u0644\u062A\u0648\u0627\u0632\u0646\u060C \u0627\u062D\u062A\u0631\u0645\u0647\u0627.",
      "\u0627\u0644\u0623\u062C\u062F\u0627\u062F \u064A\u0648\u062C\u0647\u0648\u0646 \u062E\u0637\u0648\u0627\u062A\u0643 \u0627\u0644\u064A\u0648\u0645.",
      "\u0647\u062A\u0649 \u0627\u0644\u062A\u0636\u062D\u064A\u0629 \u0627\u0644\u0635\u063A\u064A\u0631\u0629 \u062A\u0632\u064A\u0644 \u0623\u0643\u0628\u0631 \u0627\u0644\u0639\u0642\u0628\u0627\u062A.",
      "\u0627\u0633\u062A\u0645\u0639 \u0628\u0627\u0646\u062A\u0628\u0627\u0647\u060C \u0627\u0644\u0635\u0645\u062A \u0623\u064A\u0636\u0627 \u064A\u0646\u0637\u0642 \u0628\u0627\u0644\u062D\u0642\u0627\u0626\u0642.",
      "\u0643\u0644 \u0641\u062C\u0631 \u064A\u062C\u0644\u0628 \u0641\u0631\u0635\u0627 \u062E\u0641\u064A\u0629.",
      "\u0627\u0644\u0642\u0648\u0629 \u062A\u0646\u0645\u0648 \u0639\u0646\u062F\u0645\u0627 \u062A\u0645\u0634\u0627\u0631\u0643 \u0645\u0639 \u0627\u0644\u0622\u062E\u0631\u064A\u0646.",
      "\u0627\u062D\u062A\u0631\u0645 \u0627\u0644\u062A\u0648\u0627\u0632\u0646 \u0628\u064A\u0646 \u0627\u0644\u0639\u0637\u0627\u0621 \u0648\u0627\u0644\u0623\u062E\u0630.",
      "\u0627\u0644\u0646\u0647\u0631 \u064A\u062C\u0631\u064A \u0628\u062B\u0627\u0628\u062A\u060C \u0648\u0647\u0643\u0630\u0627 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0631\u062D\u0644\u062A\u0643 \u0627\u0644\u0645\u062B\u0627\u0644.",
      "\u062B\u0642 \u0623\u0646 \u0623\u064A\u0627\u062F\u064B \u063A\u064A\u0631 \u0645\u0631\u0626\u064A\u0629 \u062A\u0647\u064A\u0626 \u0637\u0631\u064A\u0642\u0643."
    ],
    header: "\u0623\u0651\u0628\u062C\u0651\u0644 OLODUMARE\u060C Oduduwa\u060C Orunmila\u060C Ajagunmale\u060C Aworomaja\u060C Odu Ologbooje\u060C Egan\u060C Gbogbo Eleye\u060C Gbogbo Irunmole\u060C Ooni of Ife\u060C Gbogbo Oba Alade\u060C Araba Agbaye. \u0623\u0651\u0628\u062C\u0651\u0644 \u062C\u0645\u064A\u0639 \u0627\u0644\u0634\u064A\u0648\u062E.",
    divinationDetails: "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0639\u0631\u0627\u0641\u0629",
    oduIfa: "\u0623\u0648\u062F\u0648 \u0625\u064A\u0641\u0627",
    orientation: "\u0627\u0644\u062A\u0648\u062C\u0647 (Ire / Ayewo)",
    specificOrientation: "\u0627\u0644\u062A\u0648\u062C\u0647 \u0627\u0644\u0645\u062D\u062F\u062F",
    solution: "\u0627\u0644\u062D\u0644 (Ebo / Adimu)",
    specificSolution: "\u0627\u0644\u062D\u0644 \u0627\u0644\u0645\u062D\u062F\u062F",
    enterName: "\u0623\u062F\u062E\u0644 \u0627\u0633\u0645\u0643 \u0627\u0644\u0643\u0627\u0645\u0644",
    birthDate: "\u0627\u062E\u062A\u0631 \u062A\u0627\u0631\u064A\u062E \u0645\u064A\u0644\u0627\u062F\u0643",
    revealMessage: "\u0643\u0634\u0641 \u0627\u0644\u0631\u0633\u0627\u0644\u0629",
    or: "\u0623\u0648",
    pickNumber: "\u0627\u062E\u062A\u0631 \u0631\u0642\u0645\u064B",
    support: "\u062F\u0639\u0645 \u0627\u0644\u0645\u0634\u0631\u0648\u0639",
    disclaimer: "\u062A\u0646\u0648\u064A\u0647: orirun.com \u0644\u0623\u063A\u0631\u0627\u0636 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0648\u0627\u0644\u062A\u0639\u0644\u064A\u0645 \u0641\u0642\u0637 \u0641\u0642\u0637. \u0644\u064A\u0633 \u0645\u0642\u0635\u062F\u0627 \u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0627\u0644\u0645\u062D\u062A\u0631\u0641\u0629 \u0623\u0648 \u0627\u0644\u0646\u0635\u064A\u062D\u0629 \u0627\u0644\u0645\u0647\u0646\u064A\u0629.",
    terms: "\u0634\u0631\u0648\u0637 \u0627\u0644\u062E\u062F\u0645\u0629 \u0648\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629",
    rights: "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0642 \u0645\u062D\u0641\u0648\u0638\u0629.",
    aboutUs: "\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0639\u0646\u0627",
    sponsorship: "\u0644\u0645\u0632\u064A\u062F \u0645\u0646 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u062D\u0648\u0644 \u0627\u0644\u0631\u0639\u0627\u064A\u0629 \u0648\u0627\u0644\u0634\u0631\u0627\u0643\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0639\u0644\u0649",
    contribute: "\u0627\u0644\u0645\u0633\u0627\u0647\u0645\u0629 \u0628\u0627\u0644\u0645\u062D\u062A\u0648\u0649"
  },
  ln: {
    language: "Lingala", loading: "Kotɛlɛmisa...",
    guidance: [
      "Biloko nyonso ekangami mpe ezali na boyokani; nyonso ezali moko.",
      "Kokanga motema ezali ndakisa ya mayele.", "Molimo na yo ya kati ezali koluka boyokani — pesa yango lokumu.",
      "Bampaka bazali kolakisa yo nzela lelo.", "Mbeka moke ekoki kolongola ndambo monene ya mikakatano.",
      "Yoka malamu, pamba te kimya mpe ezali koloba solo.", "Ntɔmi nyonso eya na makambo oyo efandi na se.",
      "Nguya ezali kokola tango okanisaka elongo na basusu.", "Bokumisi ezali kati ya kopesa mpe kozwa.",
      "Ebale ezali kotambola na kimya, bongo mpe mobembo na yo esengeli bongo.",
      "Ndima ete maboko oyo ozali komona te ezali kobongisa nzela na yo."
    ],
    header: "Napesi lokumu epai ya OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Napesi lokumu epai ya bakolo nse nyonso.",
    divinationDetails: "Makambo ya Divination", oduIfa: "Odu Ifá",
    orientation: "Liyangani (Ire / Ayewo)", specificOrientation: "Liyangani ya solo",
    solution: "Lisalisi (Ebo / Adimu)", specificSolution: "Lisalisi ya solo",
    enterName: "Koma kombo na yo mobimba", birthDate: "Pona mokolo ya kobotama",
    revealMessage: "Lakisa nsango", or: "TO", pickNumber: "Pona nɔmɛrɛ moko",
    support: "Pesa lisungi na projet Orirun",
    disclaimer: "Boyebisi: orirun.com ezali mpo na mayele mpe kelasi kaka. Ezali te esengeli kobakisa to kosalela lokola toli ya mosala to ya bango ya sika.",
    terms: "Mibeko ya kosalela mpe Politiki ya kosunga bomoto", rights: "Makoki nyonso ezali na se ya bokonzi.",
    aboutUs: "Na ntina na biso", sponsorship: "Soki olingi koyeba makambo mingi mpo na kosunga to kosala elongo, benga nimero oyo",
    contribute: "Kobakisa makambo"
  },
  wo: {
    language: "Wolof", loading: "Yebumaa...",
    guidance: [
      "Lépp lëkkaloo na te am na njaboot; lépp benn la.", "Muñ moo tax ñu xam xam.",
      "Sa safara ci biir dafay seet jàmm — jël ko ci njukël.", "Aji-dëkk yi laay jàngal boppu laaj bi leegi.",
      "Saxar bu ndaw moo man a nekk jaamu bu mag.", "Déggal bu baax; sukkandiku itam moo wax dëgg.",
      "Suba bu nekk dafay indi yoon yu jàmm.", "Dóomu doole dafay yokk bu ñu bokk ak beneen.",
      "Njub te liggéey bu baax dafay nekk ci jox ak jot.",
      "Dex bu ñu jëm moo tax ndank, boole sa yoon ak ndank gi.",
      "Na nga gëm ne loxo yi nga xamul di laajal sa yoon."
    ],
    header: "Dinaa sant OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. Dina sant mboq yi ak mag yi lépp.",
    divinationDetails: "Bennal yu ñu wax ci faale Ifá", oduIfa: "Odu Ifá",
    orientation: "Jëmm (Ire / Ayewo)", specificOrientation: "Jëmm bu jëkk",
    solution: "Téeméeru (Ebo / Adimu)", specificSolution: "Téeméeru bu jëkk",
    enterName: "Bindal sa tur bu yagg", birthDate: "Tannal besu njaboot",
    revealMessage: "Wone xibaar bi", or: "WALLA", pickNumber: "Tannal limu benn",
    support: "Tàmmaas ak projekti Orirun",
    disclaimer: "Wone: orirun.com mooy xamle ak jàng bu ñu jëfandikoo. Du jëfandikoo ngir jox ndigël walla toli bu jëfandikukat.",
    terms: "Ndigël yu jëfandikoo ak politig bii ci sutura", rights: "Saafara yi lépp ñu ko am nañu.",
    aboutUs: "Lu jëm ci nun", sponsorship: "Ngir xam lu gën ci jëmm ak doxalin, waajal ci telefon bi",
    contribute: "Bokk ay xëtu"
  },
  bm: {
    language: "Bambara", loading: "K'an bɛn kɛla...",
    guidance: [
      "Fɛn bɛɛ bɛ se ka taa ni ɲɔgɔn ye; fɛn bɛɛ kelen don.", "Sabaraw ka fisa ka doni don.",
      "Ni hakili ka taa ni kɛ, na ka fɛ ka jɔya.", "Kɔrɔba la kɛ i la yɔrɔ ka kan.",
      "Sacrifice kɔrɔ bɛ b'a fɛ ka kɛ kɛlɛ bɛɛ ka tɔ.", "Silen bɛ kuma doni doni, o ye fɔ nyɛnyɛ de.",
      "Sɔgɔma kelen kelen bɛ bara fɛɛn fɛɛ.", "Kɛlɛya bɛ ka bonya ni i bɛ tɔ nyɛ fɛ.",
      "Ka di ni ka min bɛ nyɛ, o bɛ fɛ ka fɔ jɔ.", "Ba bɛ taa nyuman nyuman, i ma taa ka nyɛ tɛmɛ ye.",
      "I ka gɛmɛn don ka bɔ i ka yɔrɔ kɔnɔ."
    ],
    header: "N bɛ fɔ OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Ologbooje, Egan, Gbogbo Eleye, Gbogbo Irunmole, Ooni of Ife, Gbogbo Oba Alade, Araba Agbaye. N bɛ fɔ kɔrɔbaw bɛɛ la ni baro kɛlaw bɛɛ la.",
    divinationDetails: "Ifa ka fɔlɔw ka ɲɛnabɔ", oduIfa: "Odu Ifá",
    orientation: "Nyɛtɛ (Ire / Ayewo)", specificOrientation: "Nyɛtɛ kelen",
    solution: "Kɔfɛ (Ebo / Adimu)", specificSolution: "Kɔfɛ kelen",
    enterName: "Ka sɔ i tɔgɔ kɛla fɛɛ", birthDate: "Ka sɛgɛsɛgɛ i ka doni kalo",
    revealMessage: "Ka yɛlɛ n taara", or: "WALA", pickNumber: "Ka filen kɛ kalo kelen",
    support: "Ka dɛmɛ Orirun projekti la",
    disclaimer: "Fɔ: orirun.com bɛ kɛ ka sɛgɛsɛgɛ ni ka ɲini fɛ. A tɛ kɛ ka sigida jɛ fɔ walla dɛmɛw la.",
    terms: "Ka sɛbɛn fila ni ka sutura la baro", rights: "Hakɛ bɛɛ bɛ sɔrɔ.",
    aboutUs: "A la kɛ n ye", sponsorship: "Ni i b'a fɛ ka dɛmɛ ni ka boloma, i bɛ sɔrɔ nɔmba kɔnɔ ye ka waati ta.",
    contribute: "Ka kɔnɔkow don"
  }
};

/* ─────────────────────────────────────────────────────────────
 *  SETUP
 * ───────────────────────────────────────────────────────────── */
let currentLang  = "baseline";
const newpreloader  = document.getElementById("new-preloader");
const languageSelect = document.getElementById("language-select");

/* ─────────────────────────────────────────────────────────────
 *  TEXT DIRECTION (RTL support)
 *  Languages whose script reads right-to-left. Add future RTL
 *  codes here (e.g. "he", "fa", "ur") if they join LANGUAGES.
 * ───────────────────────────────────────────────────────────── */
const RTL_LANGS = new Set(["ar"]);

/**
 * _applyDirection — set <html dir> (and lang) to match the
 * selected language. Called on initial load and on every change,
 * so layout flips to RTL for Arabic and back to LTR otherwise.
 */
function _applyDirection(lang) {
  try {
    const html = document.documentElement;
    html.setAttribute("dir", RTL_LANGS.has(lang) ? "rtl" : "ltr");
    html.setAttribute(
      "lang",
      (lang && lang !== "baseline" && LANGUAGES[lang]) ? lang : "en"
    );
  } catch {}
}

const IGNORE_TEXTS = [
  "please provide the text to translate",
  "please paste the app text you want translated",
  "it looks like the source text is missing",
  "translation failed", "loading", "translating",
];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT"]);

function normalize(str) {
  return (str || "").toLowerCase().replace(/\s+/g, " ").trim();
}
function shouldIgnoreText(text) {
  const n = normalize(text);
  if (!n) return true;
  if (/^[\s\p{P}\p{S}]+$/u.test(text)) return true;
  return IGNORE_TEXTS.some(p => n === p);
}

/* ─────────────────────────────────────────────────────────────
 *  TRANSLATION LOADER
 *  Renamed from showPreloader/hidePreloader to avoid
 *  overwriting main.js's preloader functions.
 * ───────────────────────────────────────────────────────────── */
function showTranslationLoader() {
  if (!newpreloader) return;
  newpreloader.style.display = "flex";
  newpreloader.style.justifyContent = "center";
  newpreloader.style.alignItems = "center";
}
function hideTranslationLoader() {
  if (!newpreloader) return;
  newpreloader.style.display = "none";
}

/* Show the overlay only if work takes a moment, and never let it linger:
   it hides as soon as the translation batch resolves, or after a short cap
   (any remaining strings keep filling in progressively afterwards). */
const LOADER_SHOW_DELAY  = 150;    // ms before showing — skips a flash on cached/instant switches
const LOADER_MAX_VISIBLE = 1500;   // ms max on screen before auto-hiding
async function withTranslationLoader(work) {
  let shown = false;
  const showTimer = setTimeout(() => { showTranslationLoader(); shown = true; }, LOADER_SHOW_DELAY);
  try {
    await Promise.race([
      Promise.resolve(work),
      new Promise((r) => setTimeout(r, LOADER_SHOW_DELAY + LOADER_MAX_VISIBLE)),
    ]);
  } finally {
    clearTimeout(showTimer);
    if (shown) hideTranslationLoader();
  }
}

/* Network timeout — a stalled request can't wedge the UI / lock the picker. */
function _fetchT(url, opts, ms = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

/* Send the language NAME to the API (the model mistranslates bare codes). */
function _langName(code) {
  return (typeof LANGUAGES !== "undefined" && LANGUAGES[code]) ? LANGUAGES[code] : code;
}

/* Split work so no single request is big enough to truncate or misalign. */
function _chunk(arr, maxCount, maxChars) {
  const out = []; let cur = []; let chars = 0;
  for (const s of arr) {
    if (cur.length && (cur.length >= maxCount || chars + s.length > maxChars)) {
      out.push(cur); cur = []; chars = 0;
    }
    cur.push(s); chars += s.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

/* Run chunks with bounded concurrency. */
async function _runChunks(chunks, fn, concurrency = 3) {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, async () => {
    while (i < chunks.length) { const idx = i++; await fn(chunks[idx]); }
  });
  await Promise.all(workers);
}

/* Translation activity: while ANY translation is running we disable the
   language picker and show a small "Translating…" pill, so the user can tell
   when the page is fully translated and can't switch languages mid-way.
   A counter handles overlapping operations (switch + dynamic content). */
let _activeTranslations = 0;
let _statusEl = null;
function _ensureStatusEl() {
  if (_statusEl) return;
  _statusEl = document.createElement("span");
  _statusEl.id = "translation-status";
  _statusEl.setAttribute("role", "status");
  _statusEl.setAttribute("aria-live", "polite");
  _statusEl.style.cssText =
    "position:fixed; top:34px; left:10px; z-index:9999; display:none;" +
    "align-items:center; gap:6px; padding:3px 10px; border-radius:999px;" +
    "background:#fff; border:1px solid rgba(20,40,30,.14);" +
    "box-shadow:0 2px 8px rgba(20,45,30,.12);" +
    "font-size:12px; font-weight:700; color:#0a5a2c;";
  _statusEl.innerHTML =
    '<span class="spinner" style="width:12px;height:12px;border-width:2px;margin:0;"></span>' +
    '<span>Translating…</span>';
  document.body.appendChild(_statusEl);
}
function _noteFreshAI() {
  if (!window.__trFreshAI) return;
  window.__trFreshAI = false;
  let note = document.getElementById("translation-fresh-note");
  if (!note) {
    note = document.createElement("div");
    note.id = "translation-fresh-note";
    note.setAttribute("role", "status");
    note.style.cssText =
      "position:fixed; bottom:88px; left:50%; transform:translateX(-50%); z-index:9999;" +
      "max-width:min(92vw,420px); padding:8px 16px; border-radius:999px; text-align:center;" +
      "background:#0e5a32; color:#eef4ea; font-size:12px; font-weight:600;" +
      "box-shadow:0 6px 18px rgba(11,61,34,.28); opacity:0; transition:opacity .25s;";
    note.textContent = "Some phrases were translated for the first time and saved for review.";
    document.body.appendChild(note);
  }
  note.style.opacity = "1";
  clearTimeout(note._t);
  note._t = setTimeout(() => { note.style.opacity = "0"; }, 4200);
}

function _beginActivity() {
  _activeTranslations++;
  if (_activeTranslations === 1) {
    _ensureStatusEl();
    if (_statusEl) _statusEl.style.display = "inline-flex";
    if (languageSelect) {
      languageSelect.disabled = true;
      languageSelect.style.cursor = "wait";
      languageSelect.style.opacity = "0.6";
    }
  }
}
function _endActivity() {
  _activeTranslations = Math.max(0, _activeTranslations - 1);
  if (_activeTranslations === 0) {
    if (_statusEl) _statusEl.style.display = "none";
    if (languageSelect) {
      languageSelect.disabled = false;
      languageSelect.style.cursor = "";
      languageSelect.style.opacity = "";
    }
  }
  if (_activeTranslations === 0) _noteFreshAI();
}

/* ─────────────────────────────────────────────────────────────
 *  LANGUAGE DROPDOWN
 * ───────────────────────────────────────────────────────────── */
(function populateLanguageDropdown() {
  const savedLang = localStorage.getItem("appLanguage");
  if (savedLang && LANGUAGES[savedLang]) currentLang = savedLang;
  _applyDirection(currentLang);
  for (const [code, name] of Object.entries(LANGUAGES)) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    if (code === currentLang) option.selected = true;
    languageSelect.appendChild(option);
  }
})();

/* (single change handler lives in the bootstrap block below) */

/* ─────────────────────────────────────────────────────────────
 *  LANGUAGE HELPERS
 * ───────────────────────────────────────────────────────────── */
function getUserLanguage() {
  try {
    const cached = localStorage.getItem("appLanguage");
    if (cached && LANGUAGES[cached]) return cached;
  } catch {}
  if (currentLang === "baseline") return "en";
  if (LANGUAGES[currentLang]) return currentLang;
  return "en";
}

function setLanguage(lang) {
  if (LANGUAGES[lang]) {
    currentLang = lang;
    localStorage.setItem("appLanguage", lang);
  }
}

function getGuidance(lang) {
  const msgs = translations[lang]?.guidance || translations["en"].guidance;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function showLoading(lang) {
  const loadingText  = translations[lang]?.loading || translations["en"].loading;
  const guidanceText = getGuidance(lang);

  document.getElementById("flag").innerHTML =
    `<img src='./public/img/flag.gif' height='50px'/>`;

  document.getElementById("loading-screen").innerHTML = `
    <div class="loading-container">
      <div class="guidance-card">
        <p class="loading-text">
          <span class="spinner"></span>
          ${loadingText}
        </p>
        <em>${guidanceText}</em>
      </div>
    </div>`;
}

/* -----------------------------------------------------------------
 *  TRANSLATION CORE  (batched · structure-preserving · cached)
 *
 *  One engine for both paths:
 *    • language switch  -> translatePage()         (all elements)
 *    • dynamic results  -> debounced observer flush (new elements)
 *
 *  Fast AND correct:
 *    - translates the TEXT NODES under each element, so inner HTML
 *      (links, buttons, nested spans) is preserved;
 *    - every uncached string in the whole batch goes out in ONE
 *      /api/translate/batch call (deduped);
 *    - results cache in-memory + localStorage; oversized values stay
 *      in memory only, so the quota is never hit silently;
 *    - only OUTERMOST [data-translate] elements are processed, which
 *      removes the old parent+child double-translation.
 * ----------------------------------------------------------------- */

/* cache: memory first, localStorage second, size-guarded */
const _memCache = new Map();
const _MAX_LS_VALUE = 4000;            // chars; bigger values -> memory only

const _CACHE_NS = "tr2";   // bump to invalidate stale cached translations
function _cacheGet(lang, text) {
  const k = `${_CACHE_NS}:${lang}::${text}`;
  if (_memCache.has(k)) return _memCache.get(k);
  try {
    const v = localStorage.getItem(k);
    if (v !== null) { _memCache.set(k, v); return v; }
  } catch {}
  return null;
}
function _cacheSet(lang, text, val) {
  const k = `${_CACHE_NS}:${lang}::${text}`;
  _memCache.set(k, val);
  if (val && val.length <= _MAX_LS_VALUE) {
    try { localStorage.setItem(k, val); } catch {}
  }
}

function _isTranslatableLang(lang) {
  return !!lang && lang !== "baseline" && !!LANGUAGES[lang];
}

/* keep only elements with no translatable ancestor (outermost) */
function _outermost(els) {
  const out = [];
  const seen = new Set();
  for (const el of els) {
    if (!el || el.nodeType !== 1 || seen.has(el)) continue;
    seen.add(el);
    if (!el.hasAttribute("data-translate")) continue;   // text roots only; attribute-only nodes (e.g. tooltips) handled separately
    if (!el.parentElement || !el.parentElement.closest("[data-translate]")) out.push(el);
  }
  return out;
}

/* visible text nodes under root, skipping script/style/etc. */
function _textNodesUnder(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      for (let p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) {
        if (p.nodeType === 1 && SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

/* static dictionary translation when the element carries a known key */
function _applyStaticKey(el, lang) {
  const key = el.getAttribute("data-translate");
  if (key && key !== "true" && translations[lang] && translations[lang][key]) {
    el.textContent = translations[lang][key];
    return true;
  }
  return false;
}

const _WS = /^(\s*)([\s\S]*?)(\s*)$/;

/* the engine: translate a set of root elements in one batch */
async function _translateRoots(rootEls, targetLang) {
  if (!_isTranslatableLang(targetLang)) return;
  const elements = _outermost(rootEls);

  // elements needing attribute translation (placeholder / title / aria-label …)
  const attrEls = new Set();
  for (const el of rootEls) {
    if (el.nodeType === 1 && el.matches && el.matches("[data-translate-attr]")) attrEls.add(el);
    if (el.querySelectorAll) el.querySelectorAll("[data-translate-attr]").forEach((e) => attrEls.add(e));
  }
  if (!elements.length && !attrEls.size) return;

  _beginActivity();   // lock the language picker + show status while working
  try {

  const jobs = [];          // { node, lead, core, trail }
  const attrJobs = [];      // { el, attr, core }
  const needed = new Set(); // unique strings to request

  for (const el of elements) {
    if (el.getAttribute("data-original") == null) {
      el.setAttribute("data-original", el.innerHTML);   // remember source once
    }
    if (el.dataset.tstate === targetLang) continue;     // already translated
    if (_applyStaticKey(el, targetLang)) continue;      // static dict hit

    for (const node of _textNodesUnder(el)) {
      const m = node.nodeValue.match(_WS);
      const lead = m[1], core = m[2], trail = m[3];
      if (!core || shouldIgnoreText(core)) continue;
      const cached = _cacheGet(targetLang, core);
      if (cached !== null) { node.nodeValue = lead + cached + trail; continue; }
      jobs.push({ node, lead, core, trail });
      needed.add(core);
    }
  }

  // attribute jobs: source read from data-o-<attr>, translation written to <attr>
  for (const el of attrEls) {
    const attrs = (el.getAttribute("data-translate-attr") || "").split(",").map((a) => a.trim()).filter(Boolean);
    for (const attr of attrs) {
      const okey = "data-o-" + attr;
      if (el.getAttribute(okey) == null) el.setAttribute(okey, el.getAttribute(attr) || "");
      const core = (el.getAttribute(okey) || "").trim();
      if (!core || shouldIgnoreText(core)) continue;
      const cached = _cacheGet(targetLang, core);
      if (cached !== null) { el.setAttribute(attr, cached); continue; }
      attrJobs.push({ el, attr, core });
      needed.add(core);
    }
  }

  if (needed.size) {
    const uniques = [...needed];
    const map = new Map();
    const apiLang = _langName(targetLang);   // send the NAME, not the code

    const translateOne = async (str) => {     // reliable per-string fallback
      try {
        const r = await _fetchT("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: str, targetLang: apiLang }),
        });
        const d = await r.json();
        const v = d.translated || str;
        map.set(str, v); _cacheSet(targetLang, str, v);
      } catch { map.set(str, str); }
    };

    // chunk so a long reading can't truncate or misalign the response
    const chunks = _chunk(uniques, 20, 2400);
    await _runChunks(chunks, async (chunk) => {
      let arr = null;
      try {
        const res = await _fetchT("/api/translate/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: chunk, targetLang: apiLang }),
        }, 25000);
        if (res.ok) {
          const { translated, source } = await res.json();
          // only trust a response that lines up exactly with what we sent
          if (Array.isArray(translated) && translated.length === chunk.length) arr = translated;
          // Translation memory: the caveat is now conditional. It applies
          // only when strings NOBODY has translated before were machine-
          // translated this run (they are saved for curation immediately).
          if (source && source.ai > 0) window.__trFreshAI = true;
        }
      } catch (err) { console.error("Batch chunk failed:", err); }

      if (arr) {
        chunk.forEach((str, i) => {
          const v = (typeof arr[i] === "string" && arr[i].trim()) ? arr[i] : str;
          map.set(str, v); _cacheSet(targetLang, str, v);
        });
      } else {
        await Promise.all(chunk.map(translateOne));   // mismatch/failure -> per-item
      }
    }, 3);

    for (const j of jobs) {
      const v = _cacheGet(targetLang, j.core) ?? map.get(j.core) ?? j.core;
      j.node.nodeValue = j.lead + v + j.trail;
    }
    for (const j of attrJobs) {
      const v = _cacheGet(targetLang, j.core) ?? map.get(j.core) ?? j.core;
      j.el.setAttribute(j.attr, v);
    }
  }

  elements.forEach((el) => { el.dataset.tstate = targetLang; });
  attrEls.forEach((el) => { el.dataset.tattr = targetLang; });

  } finally {
    _endActivity();
  }
}

/* public: translate the whole page (language switch / load) */
async function translatePage(targetLang) {
  const all = Array.from(document.querySelectorAll("[data-translate], [data-translate-attr]"));
  if (!all.length) return;
  all.forEach((el) => {                                 // restore source text first
    const base = el.getAttribute("data-original");
    if (base != null) el.innerHTML = base;
    delete el.dataset.tstate;
    delete el.dataset.tattr;
  });
  await _translateRoots(all, targetLang);
}

/* public: restore English / baseline */
function restoreOriginalHTML() {
  document.querySelectorAll("[data-translate]").forEach((el) => {
    const base = el.getAttribute("data-original");
    if (base != null) el.innerHTML = base;
    delete el.dataset.tstate;
  });
  document.querySelectorAll("[data-translate-attr]").forEach((el) => {
    (el.getAttribute("data-translate-attr") || "").split(",").map((a) => a.trim()).filter(Boolean).forEach((attr) => {
      const okey = "data-o-" + attr;
      if (el.getAttribute(okey) != null) el.setAttribute(attr, el.getAttribute(okey));
    });
    delete el.dataset.tattr;
  });
}

/* single-string helper for ad-hoc callers (chatbot, popups) */
async function translateWithCache(text, targetLang) {
  const core = (text || "").trim();
  if (!core || !_isTranslatableLang(targetLang)) return text;
  if (translations[targetLang]) {
    for (const [key, val] of Object.entries(translations.en)) {
      if (val === core && translations[targetLang][key]) return translations[targetLang][key];
    }
  }
  const cached = _cacheGet(targetLang, core);
  if (cached !== null) return cached;
  try {
    const res = await _fetchT("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: core, targetLang: _langName(targetLang) }),
    });
    const d = await res.json();
    const v = d.translated || core;
    _cacheSet(targetLang, core, v);
    return v;
  } catch (err) {
    console.error("Translation failed:", err);
    return text;
  }
}

/* dynamic content: debounced, batched observer */
const _pending = new Set();
let _flushTimer = null;

function _scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(async () => {
    _flushTimer = null;
    if (!_isTranslatableLang(currentLang) || !_pending.size) { _pending.clear(); return; }
    const roots = [..._pending].filter((el) => el.isConnected);
    _pending.clear();
    if (roots.length) {
      try { await _translateRoots(roots, currentLang); } catch (e) { console.error(e); }
    }
  }, 60);
}

function handleNewContent(mutations) {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") continue;
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== 1) return;
      if (node.matches && (node.matches("[data-translate]") || node.matches("[data-translate-attr]"))) _pending.add(node);
      if (node.querySelectorAll) {
        node.querySelectorAll("[data-translate]").forEach((c) => _pending.add(c));
        node.querySelectorAll("[data-translate-attr]").forEach((c) => _pending.add(c));
      }
    });
  }
  if (_pending.size) _scheduleFlush();
}

/* let main.js trigger a deterministic pass right after rendering a result */
window.translateDynamicContent = function (target) {
  const root = target || document.body;
  const els = [];
  if (root.matches && (root.matches("[data-translate]") || root.matches("[data-translate-attr]"))) els.push(root);
  if (root.querySelectorAll) {
    root.querySelectorAll("[data-translate]").forEach((e) => els.push(e));
    root.querySelectorAll("[data-translate-attr]").forEach((e) => els.push(e));
  }
  return _translateRoots(els, currentLang);
};

/* ─────────────────────────────────────────────────────────────
 *  BOOTSTRAP
 * ───────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  // Save baseline HTML for all translatable elements
  const elements = document.querySelectorAll("[data-translate]");
  for (const el of elements) el.setAttribute("data-original", el.innerHTML);

  // Dropdown change handler
  languageSelect.addEventListener("change", async (e) => {
    currentLang = e.target.value;
    _applyDirection(currentLang);
    try { localStorage.setItem("appLanguage", currentLang); } catch {}
    if (currentLang === "baseline") {
      restoreOriginalHTML();             // instant — no overlay
      return;
    }
    await withTranslationLoader(translatePage(currentLang).catch((err) => console.error(err)));
  });

  // Apply saved language on load
  const cached = localStorage.getItem("appLanguage");
  if (cached && LANGUAGES[cached]) {
    currentLang = cached;
    _applyDirection(currentLang);
    if (currentLang !== "baseline") {
      await withTranslationLoader(translatePage(currentLang).catch((err) => console.error(err)));
    }
    languageSelect.value = currentLang;
  }

  // Watch for dynamically added content
  const observer = new MutationObserver(handleNewContent);
  observer.observe(document.body, { childList: true, subtree: true });
});

/* ─────────────────────────────────────────────────────────────
 *  INACTIVITY GUIDANCE POPUP
 * ───────────────────────────────────────────────────────────── */


let inactivityTimer;
const INACTIVITY_TIME = 9 * 60 * 1000;   // 9 minutes

/**
 * resetInactivityTimer — kept here so translation.js can call it.
 * showGuidancePopup / closeGuidancePopup now live in dailyGuidance.js.
 */
function resetInactivityTimer(lang) {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(async () => {
    if (typeof showGuidancePopup === "function") {
      await showGuidancePopup(lang || currentLang || "en");
    }
  }, INACTIVITY_TIME);
}

["mousemove", "keydown", "click", "touchstart"].forEach((ev) => {
  document.addEventListener(ev, () =>
    resetInactivityTimer(typeof currentLang !== "undefined" ? currentLang : "en")
  );
});

document.addEventListener("DOMContentLoaded", () => {
  resetInactivityTimer(typeof currentLang !== "undefined" ? currentLang : "en");
});