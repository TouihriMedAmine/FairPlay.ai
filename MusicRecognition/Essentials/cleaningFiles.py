import os

def delete_files_in_folder(source_folder, target_folder):
    """
    Delete files from source_folder if they exist in target_folder.
    
    Args:
    - source_folder (str): Path to the source folder containing files to be checked and deleted.
    - target_folder (str): Path to the target folder where existence of files will be checked.
    """
    # Get list of files in source_folder
    source_files = os.listdir(source_folder)
    
    # Get list of files in target_folder
    target_files = os.listdir(target_folder)
    
    # Iterate over files in source_folder
    for file_name in source_files:
        source_file_path = os.path.join(source_folder, file_name)
        
        # Check if file exists in target_folder
        if file_name in target_files:
            target_file_path = os.path.join(target_folder, file_name)
            
            # Delete the file from source_folder if it exists in target_folder
            print(f"Deleting {target_file_path} because it exists in {target_folder}")
            os.remove(target_file_path)
        else:
            print(f"{source_file_path} does not exist in {target_folder}")

# Example usage:
source_folder1 = "dataset2/test/music"
source_folder2 = "dataset2/validation/music"
source_folder3 = "dataset2/test/non_music"
source_folder4 = "dataset2/validation/non_music"
music_target_folder = "dataset1/music"
non_music_target_folder ="dataset1/non_music"

delete_files_in_folder(source_folder1, music_target_folder)
delete_files_in_folder(source_folder2,music_target_folder)
delete_files_in_folder(source_folder3,non_music_target_folder)
delete_files_in_folder(source_folder4,non_music_target_folder)
