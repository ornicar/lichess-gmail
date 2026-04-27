### Extra Gmail tools for Lichess team members

#### Installation

**Chrome**
- Download the extension zip: https://github.com/ornicar/lichess-gmail/archive/refs/heads/master.zip.
- Unzip it somewhere.
- Open `chrome://extensions/` in your browser.
- Remove the previous version if any.
- Click "Load unpacked" and select the unzipped folder.
- To configure your signature, click the extension icon in the toolbar.

**Firefox**
- Same steps as Chrome, but open `about:debugging`, click "This Firefox", then "Load Temporary Add-on" and select the `manifest.json` file from the unzipped folder.
- To configure your signature, click the extension icon in the toolbar.

### Hermes email templates

Hermes is an internal Lichess tool that stores our email templates. When viewing a conversation thread in Gmail, use `Ctrl+Shift+G` to expand the Hermes UI. Click a template name to reply with that template. View and edit the templates at https://hermes.lichess.app.

### Commands:

#### `Ctrl+Shift+G`

Toggles the Hermes UI on/off in the Gmail thread view.

#### `Ctrl+Shift+E`

Inserts your configured email signature at the cursor in the current email text area.

#### `Ctrl+y`

Opens lichess search user page, with the sender email.

#### `Ctrl+,` or `Ctrl+F`

For email confirmation requests. This shortcut:

- opens the [lichess email confirmation UI](https://github.com/ornicar/lila/wiki/Handling-email-address-confirmation) in a new tab, with the email loaded
- prepares a gmail reply with the corresponding canned response, in case the email confirmation succeeded
- changes our sending email from `contact@lichess.org` to `lichess.contact@gmail.com`, in case the user's email provider blocks `lichess.org` (it happens).

#### Select text, right click menu

Smart navigate:

- If an email address is part of selection, open lichess email search
- Else if a lichess account is part of selection, open mod page for account.
