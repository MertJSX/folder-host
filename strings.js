const strings = {
defaultConfig: `
# Port is required. Don't delete it!
port: 5000

# This is folder path. You can change it, but don't delete.
folder: "./test"

# Limit of the folder. Examples: 10 GB, 300 MB, 5.5 GB, 1 TB...
# You can remove it if you trust users.
storage_limit: "20 GB"

# This is password for access. You can delete it if you want, but it's good to have a password.
password: "123"

# You can manage user permissions.
permissions:
    read_directories: true
    read_files: true
    create: true
    change: true
    delete: true
    move: true
    download: true
    upload: true
    rename: true

# This is not working for now. (TEST)
accounts:
    - name: "admin"
      password: "wQcl6651gqR33@@@@$"
      permissions:
          - read_directories
          - read_files
          - create
          - change
          - delete
          - move
          - download
          - upload
          - rename
    - name: "moderator"
      password: "lJsY1186431ax05"
      permissions:
          - read_directories
          - read_files
          - create
          - change
          - delete
          - move
          - download
          - upload
          - rename

# Holds deleted files. Accidentally, you might delete files that you don't want to delete.
recovery_bin: true
# Optionally you can limit recovery_bin storage. You can remove it if you want.
# bin_storage_limit: "10 GB"
`,
}

module.exports = { strings }