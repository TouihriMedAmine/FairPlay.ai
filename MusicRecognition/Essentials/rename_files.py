import os

def rename_files(directory, new_name):
    i=1

    # Ensure the directory exists
    if not os.path.isdir(directory):
        print("Error: Directory not found.")
        return
    
    # Get a list of all files in the directory
    files = os.listdir(directory)
    
    # Rename each file
    for old_name in files:
        # Construct the new file name
        _, file_extension = os.path.splitext(old_name)
        new_file_name = new_name + "_"+ str(i) + file_extension
        i=i+1
        # Construct the full paths
        old_path = os.path.join(directory, old_name)
        new_path = os.path.join(directory, new_file_name)
        
        # Rename the file
        try:
            os.rename(old_path, new_path)
            print(f"Renamed '{old_name}' to '{new_file_name}'")
        except Exception as e:
            print(f"Error renaming '{old_name}': {e}")

# Example usage
if __name__ == "__main__":
    directory = "dataset1/music"
    new_name = "music"
    
    rename_files(directory, new_name)
