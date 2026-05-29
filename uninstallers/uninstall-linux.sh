#!/bin/bash
APP_NAME="My Doryoku Log"
APP_CONFIG_NAME="MyDoryokuLog"
APP_ID="org.kiyo.my-doryoku-log"
APPIMAGE_PATTERN="My Doryoku Log*.AppImage"
echo "Uninstalling $APP_NAME..."
# Remove AppImage from common locations
for DIR in "$HOME" "$HOME/Applications" "$HOME/Desktop" "/opt" "/usr/local/bin"; do
    find "$DIR" -maxdepth 1 -name "$APPIMAGE_PATTERN" -exec rm -f {} \; 2>/dev/null
done
# Remove desktop entry and icon
rm -f "$HOME/.local/share/applications/${APP_ID}.desktop"
# Remove user data and residual files
rm -rf "$HOME/.config/${APP_CONFIG_NAME}"
rm -rf "$HOME/.cache/${APP_NAME}"
rm -rf "$HOME/.local/share/${APP_NAME}"
echo "$APP_NAME has been uninstalled"
