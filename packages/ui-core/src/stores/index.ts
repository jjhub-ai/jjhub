export {
    configureStorage,
    createPersistentAtom,
    readStoredString,
    writeStoredString,
    removeStoredString,
    readStoredJSON,
    writeStoredJSON,
    type StorageBackend,
} from "./storage";

export {
    $diffViewMode,
    $diffWhitespaceMode,
    $collapsedDiffFiles,
    setDiffViewMode,
    toggleDiffViewMode,
    setDiffWhitespaceMode,
    setCollapsedDiffFile,
    toggleCollapsedDiffFile,
    resetDiffPreferences,
    type DiffViewMode,
    type DiffWhitespaceMode,
} from "./diff-preferences";

export {
    isSidebarCollapsed,
    isAgentDockOpen,
    isTerminalOpen,
    isCommandPaletteOpen,
    isKeyboardHelpOpen,
    isKeyboardNavigationMode,
    $editorVimMode,
    $editorTheme,
    $editorFontSize,
    toggleSidebar,
    toggleAgentDock,
    toggleTerminal,
    toggleCommandPalette,
    openKeyboardHelp,
    closeKeyboardHelp,
    toggleKeyboardHelp,
    type EditorThemePreference,
} from "./workbench";

export {
    featureFlags,
    featureFlagsLoaded,
    initFeatureFlags,
    isFeatureEnabled,
} from "./feature-flags";
