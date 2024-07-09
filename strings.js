const strings = {
defaultConfig: `
# Port is required. Don't delete it!
port: 5000

# This is folder path. You can change it, but don't delete.
folder: './test'

# This is password for access. You can delete it if you want, but it's good to have a password.
password: '123'

# You can manage user permissions.
permissions:
    read_directories: true
    read_files: true
    create: false
    change: true
    delete: true
    move: true
    download: true
    upload: true
    rename: true

# Holds deleted files. Accidentally, you might delete files that you don't want to delete.
recovery_bin: true
`,
}

module.exports = { strings }