class DirItem {
    constructor(name, parentPath, isDirectory, size) {
        this.name = name;
        this.parentPath = parentPath;
        this.isDirectory = isDirectory;
        if (size) {
            this.size = size;
        }
    }
}

module.exports = {DirItem}