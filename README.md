
# Fish Admin Panel

Panel administracyjny do zarządzania użytkownikami, kontrolami straży rybackiej oraz statystykami strażników dla Okręgu Mazowieckiego PZW.

## Funkcje

- Zarządzanie użytkownikami (dodawanie, usuwanie, logi operacji)
- Przeglądanie historii kontroli z filtrami i eksportem do CSV
- Statystyki strażników (liczba patroli, liczba kontroli, pozytywne/negatywne kontrole)
- Zaawansowane filtrowanie i paginacja
- Eksport danych do plików CSV
- Integracja z Firebase (Firestore, Auth)

## Wymagania

- Node.js >= 16
- Konto Firebase z aktywną bazą Firestore

## Instalacja

1. Sklonuj repozytorium:
   ```bash
   git clone https://github.com/negatywy/fish-admin-panel.git
   cd fish-admin-panel
   ```
2. Zainstaluj zależności:
   ```bash
   npm install
   ```
3. Skonfiguruj Firebase:
   - Utwórz plik `src/config/firebase.js` z konfiguracją Firebase (apiKey, authDomain, itp.)
   - Upewnij się, że reguły Firestore pozwalają na dostęp zgodnie z wymaganiami aplikacji

## Uruchomienie

### Tryb deweloperski

```bash
npm start
```
Otwórz [http://localhost:3000](http://localhost:3000) w przeglądarce.

### Budowanie do produkcji

```bash
npm run build
```
Wynik znajdziesz w folderze `build/`.

## Deployment

Aplikacja została wdrożona na Firebase Hosting.

### Firebase Hosting
1. Zainstaluj narzędzia:
   ```bash
   npm install -g firebase-tools
   ```
2. Zaloguj się:
   ```bash
   firebase login
   ```
3. Zainicjuj hosting (jeśli pierwszy raz):
   ```bash
   firebase init hosting
   ```
4. Wdróż aplikację:
   ```bash
   firebase deploy
   ```

## Konfiguracja środowiska

Ustaw dane dostępowe do Firebase w pliku `src/config/firebase.js`:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## Licencja

Wszelkie prawa zastrzeżone. Projekt udostępniony wyłącznie w celach prezentacyjnych (portfolio). Kopiowanie, modyfikacja i wykorzystywanie bez zgody autora zabronione.
