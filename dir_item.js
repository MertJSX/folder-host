class DirItem {
    constructor(name, parentPath, path, isDirectory, birthDate, dateModified, size) {
        this.name = name;
        this.parentPath = parentPath;
        this.path = path;
        this.isDirectory = isDirectory;
        this.birthDate = birthDate;
        this.dateModified = dateModified;
        if (size) {
            this.size = size;
        }
    }
}

module.exports = {DirItem}