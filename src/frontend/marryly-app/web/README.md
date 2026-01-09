# Marryly - Aplikacja Weselna

Elegancka aplikacja webowa do obsługi wesela Alicji i Piotra (31 lipca 2026).

## 🎯 Funkcjonalności

- **Strona główna** - Wizytówka wesela z informacjami
- **Menu wesela** - Szczegółowe menu dla gości
- **Atrakcje** - Lista przygotowanych atrakcji
- **Wydarzenia** - Harmonogram dnia
- **Galeria** - Przeglądanie zdjęć na żywo
- **Upload zdjęć** - Goście mogą dodawać własne zdjęcia i filmy
- **Księga gości** - Miejsce na życzenia i wspomnienia
- **Slideshow** - Pokaz slajdów na sali weselnej
- **Panel admina** - Zarządzanie treścią i ustawieniami

## 🚀 Uruchomienie

### Instalacja zależności
```bash
npm install
```

### Uruchomienie w trybie deweloperskim
```bash
npm run dev
```

Aplikacja uruchomi się na `http://localhost:5173`

### Build produkcyjny
```bash
npm run build
```

### Preview buildu produkcyjnego
```bash
npm run preview
```

## 🛠️ Stack technologiczny

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **PostCSS** - CSS processing

## 📁 Struktura projektu

```
web/
├── src/
│   ├── api/              # API client
│   ├── app/              # Konfiguracja i routing
│   ├── assets/           # Zdjęcia i media
│   ├── components/       # Komponenty UI
│   ├── pages/            # Strony aplikacji
│   ├── types/            # TypeScript types
│   ├── App.tsx           # Główny komponent
│   ├── main.tsx          # Entry point
│   └── index.css         # Globalne style
├── public/               # Pliki statyczne
└── package.json          # Zależności
```

## 🎨 Paleta kolorów

- **Paper**: #F5F1E8 (główne tło)
- **Sand**: #E9E4DC (ramki, separator)
- **Ink**: #1F1F1F (tekst główny)
- **Muted**: #9A9A9A (tekst drugorzędny)
- **Gold**: #C9A24D (akcenty)

## 📝 Licencja

Prywatny projekt weselny © 2026
