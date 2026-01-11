# RaiFocus 🚀

**RaiFocus** is a stunning, premium productivity desktop application built with Electron.js. It combines a powerful **Time Tracker**, a hierarchical **Todo System**, and an automated **Break Timer (Pomodoro)** to help you stay focused and manage your work efficiently.

![RaiFocus Mockup](https://raw.githubusercontent.com/bdraihan71/RaiFocus/main/assets/readme_banner.png)

## ✨ Key Features

-   **⏱️ Advanced Time Tracker**: Track your focus sessions by project.
-   **📝 Hierarchical Todos**: Manage tasks with projects, priorities, and subtasks.
-   **🔄 Task Status Management**: Easily move tasks between `To Do`, `In Progress`, and `Completed`.
-   **☕ Automated Break Timer**: Stay healthy with built-in Pomodoro-style work and break reminders.
-   **📊 Analytics Dashboard**: Visualize your productivity with detailed charts and daily summaries.
-   **💎 Premium UI**: Modern dark theme with glassmorphism, smooth animations, and high contrast for readability.

## 🚀 Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16.x or later)
-   npm (included with Node.js)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/bdraihan71/RaiFocus.git
    cd RaiFocus
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the application:
    ```bash
    npm start
    ```

## 🛠️ Build & Packaging

To create a production-ready executable for Windows, follow these steps:

### Windows Build
```bash
npm run build:win
```
This will generate an installer in the `dist` folder.

### Other Platforms
To build for macOS or Linux, you can use:
```bash
npm run build
```

The build process uses `electron-builder` and is pre-configured in `package.json`.

## 📂 Project Structure

-   `main.js`: Electron main process and IPC handlers.
-   `preload.js`: Bridge between main and renderer processes.
-   `src/renderer`: Frontend logic, styles, and views.
    -   `scripts/`: Logic for Time Tracker, Todos, Break Timer, etc.
    -   `styles/`: Modern CSS styling.
-   `src/database/`: SQLite (sql.js) implementation and schema.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
Built with ❤️ by [Raihan](https://github.com/bdraihan71)
