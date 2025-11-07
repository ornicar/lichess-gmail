### Extra gmail features to better help lichess users

#### Installation

- Download the extension zip: https://github.com/ornicar/lichess-gmail/archive/refs/heads/master.zip.
- Unzip it somewhere.
- Open chrome://extensions/ in your browser.
- Remove the previous version if any.
- Click "Load unpacked" and select the unzipped folder.

### Commands:

#### `Ctrl+,`

For email confirmation requests. This shortcut:

- opens the [lichess email confirmation UI](https://github.com/ornicar/lila/wiki/Handling-email-address-confirmation) in a new tab, with the email loaded
- prepares a gmail reply with the corresponding canned response, in case the email confirmation succeeded
- changes our sending email from `contact@lichess.org` to `lichess.contact@gmail.com`, in case the user's email provider blocks `lichess.org` (it happens).

#### `Ctrl+y`

Opens lichess search user page, with the sender email.

#### Select text, right click menu

Smart navigate:

- If an email address is part of selection, open lichess email search
- Else if a lichess account is part of selection, open mod page for account.
