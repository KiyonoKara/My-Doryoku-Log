#!/bin/bash
APP_NAME="My Doryoku Log"
APP_SUPPORT_NAME="MyDoryokuLog"
APP_ORG="org.kiyo"
APP_ID="org.kiyo.my-doryoku-log"
echo "Uninstalling $APP_NAME..."
# Remove the app bundle
sudo rm -rf "/Applications/${APP_NAME}.app"
# Remove user data and residual files
rm -rf "$HOME/Library/Application Support/${APP_SUPPORT_NAME}"
rm -rf "$HOME/Library/Preferences/${APP_ID}.plist"
rm -rf "$HOME/Library/Caches/${APP_ORG}"
echo "$APP_NAME has been uninstalled"
