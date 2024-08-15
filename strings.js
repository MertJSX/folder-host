const strings = {
defaultConfig: `
# Port is required. Don't delete it!
port: 5000

# This is folder path. You can change it, but don't delete.
folder: "./test"

# Limit of the folder. Examples: 10 GB, 300 MB, 5.5 GB, 1 TB...
# You can remove it if you trust users.
storage_limit: "20 GB"

# This is secret encryption key to create encrypted tokens.
secret_encryption_key: "you must change it" # Example: 5asdasd1asd

# This is secret json web token key to create tokens.
secret_jwt_key: "you must change it" # Example: 5asdasd1asd

# You can create your own accounts for access
accounts:
    # All users should have unique name
    - name: "admin"
      # user password
      password: "12345"
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
        unzip: true
        copy: true
    - name: "moderator"
      password: "123"
      permissions:
        read_directories: true
        read_files: true
        create: false
        change: false
        delete: false
        move: false
        download: false
        upload: false
        rename: false
        unzip: false
        copy: false

# Holds deleted files. Accidentally, you might delete files that you don't want to delete.
recovery_bin: false
# Optionally you can limit recovery_bin storage. You can remove it if you want.
# bin_storage_limit: "10 GB"
`,
}

module.exports = { strings }