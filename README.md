<p float="left">
  <img src="assets/collabst-logo+txt.svg" alt="collabst logo" width="150" />
  <em>(pronounced collapsed, /kəˈlæpst/)</em>
</p>

<br />

Self-host a collaborative workspace for Typst.
___
**Authors Note:** \
*Collabst is currently aimed at personal collaborative projects and scientific lab projects, and is not affiliated in any way with the Typst brand. \
We are aware of the delicate balance of the business model behind the Typst development. As such, this project **does not aim to compete with the official [Typst's official web app](https://typst.app/)**. \
Furthermore, as stated in the [license](LICENSE), we do not provide any support or garantees regarding the use of Collabst: If your organization needs to set up a reliable service with technical support, we cannot recommand enough to contact the Typst team directly, in order to get a proper paid plan for self-hosting the official web app.*

*In the long run, the Collabst project's goal is to contribute in creating the conditions for scientific knowledge to be entirely produced using sovereign tools, with open source software and easy collaboration in mind.*
<br />


## TODOs

**FIRST**:
- [ ] **Connect frontend to new backend**

### ICONS GUIDELINES
- We should use outline style svg icons
-> **where to find ?** Maybe check https://iconoir.com/
- Most ui buttons should be icon first (and label on hover)

### UX Features

#### Projects Dashboard 📁📁📁
- [ ] Create/Remove **Document** (document=project)
- [ ] Create/Remove/Move elements in **Folders**
- Dashboard sections:
  - [ ] Projects (+sort options last modified | last created | alphabetical)
  - [ ] Shared with me
  - [ ] Display style (projects and folders as big icons(/thumbnails) | as a file list)
- When hovering on project:
  - [ ] **Open** (Equivalent to double click)
  - [ ] **Download** pdf (+or source?)
  - [ ] **Duplicate** project
  - [ ] **Rename**

#### Settings Menu ⚙️
- Account settings
  - [ ] Change current **pwd**
  - [ ] Change **profil pic**
  - [ ] Change displayed **name**
- Other settings
  - [ ] **Theme** (Light | Dark | System)

#### Editor UI 📁+✏️+👁
- Left bar quick menus:
  - [ ] Project **Files**
  - [ ] **Global Search** & Replace
  - [ ] Document **Outline**
  - [ ] Eventually at the bottom Typst universe and Doc buttons
  - [ ] *Clicking on a menu button hides the menu if its already selected*
- [ ] (Menu|Editor|Preview) window separators can be dynamically moved
- Export|Share buttons:
  - Share menu:
    - [ ] create/copy read-only | review-only | reda-write link
    - [ ] share via email -> add some profile email to the project
  - Download button + drop down
    - [ ] Download as exported pdf by default
    - [ ] In dropdown: export as PDF | as PNG | as SVG | sources as ZIP

#### Editor Settings ⚙️
- Project Specific Settings:
  - [ ] Project name (maybe display in top left corner like in gdoc)
  - [ ] Typst **compiler version** (latest | specific in list)
- Editor settings:
  - [ ] Editor **font size**
  - [ ] Editor **font family** (as ordered list)
  - [ ] **Line numbers** (Normal | Relative | Disabled)
  - [ ] *Spell check* ? (included in tiny mist ?)

#### Editor Project Files menu 📁
- [ ] Buttons for new File | new Folder | Upload
- [ ] Drag & drop in file list to upload file
- [ ] List of every folder & files at root (folders first, alphabetically)
- [ ] How icon of type of file next to name
- [ ] Button for selected file to preview
- OPENING BEHAVIOURS:
  - [ ] Click folder for expand | close
  - [ ] Click text file opens it in editor (`.typ`, `.bib`, `.txt` etc)
  - [ ] Click image/svg open small preview thumbnail in instead of editor + some metadata + show right click equivalent buttons above
  - [ ] Other files (pdf etc) should just show file type icon instead of image preview + some metadata + show right click equivalent buttons above
  - Right click item in menu:
    - [ ] Rename
    - [ ] Download (only if file)
    - [ ] Replace (upload menu for single file)(only if file)
    - [ ] Remove (with warning message)
- [ ] Shortcut support (`suppr` current selected file is files menu in focus with confirmation warning, `F2` for renaming)

#### EDITOR ✏️
- Editor top buttons:
  - [ ] Bold | Italic | Underline
  - [ ] Font
  - [ ] Toggle list | toggle enumeration
  - [ ] Toggle Math Mode
  - [ ] Toggle code block
  - [ ] Add citation
  - [ ] **Add comment**
- Editor features :
  - [ ] Syntax highlight
  - [ ] Semantic suggestions
  - [ ] See collaborator's cursor & highlighing
  - [ ] *Spellcheck* (see with tiny mist) ?
  - Quality of life keyboard shortcuts:
    - [ ]  `ctrl+f` feature for find/replace bottom bar to pop up
    - [ ] `ctrl+b` for bold `ctrl+i` for italic
    - [ ] Smart indent with `tab` and `shift+tab`

#### PREVIEW 👁
- [ ] Move preview to cursor location button (could editor+preview scroll be locked together as option ?)
- [ ] Detach preview as separate window button
- Zoom options:
  - [ ] + | - and display cureent amount
  - [ ] Fixed values (25% 50% 75% 100% 200% 300%)
  - [ ] Fit to width | height | *page?*
- Zoom control with `ctrl+mouse scroll` or touchpad pinch-to-zoom
