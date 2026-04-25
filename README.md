# Orírùn Application

A full-featured African divination, numerology, and spiritual insights application built with **JavaScript**, **Node.js + Express**, and a **multi-language UI** (Yoruba, Swahili, French, English, etc). The app integrates **Ifá divination logic**, **Numerology calculations**, **Odu interpretations**, **payment access control**, and **admin tools** for data management.

---

## 🌍 Overview
This application brings together traditional **Ifá divination** with modern digital tools. It supports:
- 256 Odù Ifá representations
- Rich spiritual interpretation engine
- Elemental + Orisha mapping (Air, Fire, Water, Earth)
- Numerology (Life Path, Destiny, Expression, Soul Urge)
- Multi-language support for the UI
- Free & Premium Odù access
- Backend logging and payment monitoring
- Admin interface

---

## 🌀 Features
### 🔮 **Ifá Divination System**
- Casts and decodes Odù.
- Includes positive and negative orientation interpretations.
- Maps elements → Orishas:
  - **Air → Orunmila**
  - **Fire → Sango**
  - **Water → Obatala**
  - **Earth → Ogun**
- Produces spiritual advice, imbalances, and practical guidance.


### 🔢 **Numerology Engine**
- Life Path
- Expression Number
- Soul Urge
- Destiny Number
- Numbers 1-9 and Master Numbers 11 and 22
- Pinnacle Challenges and Energies to use
- Birthday gifts
- Planetary hour integration

### 💬 **Chatbot (Orírùn Learning Corner)**
- Internal knowledge base
- Multi-language learning assistant

### 🛂 **Premium Access Control**
- All Odù are premium by default except backend-managed free ones
- Payment modal: “Pay ₦1000 to unlock”
- Backend logs unlocking events

### 🗂️ **Admin Panel**
- Overview of appliation activities

### 📚 **History Log System**
- Logs all user divinations
- Timestamp recorded from backend

---

## 🚀 Installation
### 1. Clone Repo
```
git clone https://github.com/daygea/ancestra.git
cd ancestra
```

### 2. Install Backend
```
cd backend
npm install
```

### 3. Start Server
```
node server.js
```

### 4. Run Frontend
Open `index.html` in a browser.

---

## 🔐 Security (Protecting Endpoints)
Backend uses:
- API key verification
- Admin JWT authentication
- CORS restrictions
- Rate limiting


## 🔧 Environment Variables
Create `.env`:
```
DATA_MODE=file
MONGO_URI=
WHATSAPP_TOKEN=E
WHATSAPP_PHONE_ID=
SENDGRID_API_KEY=
NOTIFY_EMAIL=
EMAIL_HOST=
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
API_KEY=
API_KEY2=
API_CHATKEY=
SECRET_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

---

## 🌐 Deployment
### Render / CPanel
- The backend can be deployed on **Render (Free Tier)**
- Works with MongoDB Atlas

Ensure Build Command:
```
npm install
```
Start Command:
```
node server.js
```

---

## 👤 Author
**Adedeji Kadri (Osa Owonrin) - Orirun Cultural Foundation**

---

