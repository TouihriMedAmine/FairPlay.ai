import os
import shutil

def copy_files(source_dir, dest_dir, num_files):
    try:
        # Create the destination directory if it doesn't exist
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)

        # Get a list of all files in the source directory
        files = os.listdir(source_dir)

        # Ensure num_files does not exceed the total number of available files
        num_files = min(num_files, len(files))

        # Iterate through the specified number of files and copy them to the destination directory
        for i in range(num_files):
            source_file = os.path.join(source_dir, files[i])
            dest_file = os.path.join(dest_dir, files[i])

            # Copy the file
            shutil.copy2(source_file, dest_file)  # Use shutil.copy2 for metadata preservation
            

        print(f"Successfully copied {num_files} files.")
    except Exception as e:
        print(f"Error: {e}")


def move_files(source_dir, dest_dir, num_files):
    try:
        # Create the destination directory if it doesn't exist
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)

        # Get a list of all files in the source directory
        files = os.listdir(source_dir)

        # Ensure num_files does not exceed the total number of available files
        num_files = min(num_files, len(files))

        # Iterate through the specified number of files and copy them to the destination directory
        for i in range(num_files):
            source_file = os.path.join(source_dir, files[i])
            dest_file = os.path.join(dest_dir, files[i])

            # Copy the file
            shutil.move(source_file, dest_file)  # Use shutil.copy2 for metadata preservation
            

        print(f"Successfully copied {num_files} files.")
    except Exception as e:
        print(f"Error: {e}")


# Set your source and destination directories
music="dataset1/music"
non_music="dataset1/non_music"


dataset2_music = "dataset3/music"
dataset2_non_music = "dataset3/non_music"

test_music="dataset2/test/music"
tes_non_music="dataset2/test/non_music"

valudation_music="dataset2/validation/music"
valudation_non_music="dataset2/validation/non_music"
test="dataset3/test"


# Specify the number of files to copy
tocpy=1000
number_of_files_to_copy = 5000  # Change this number to the desired number of files
number_of_files_to_copy2 = 10000
# Call the function to copy the specified number of files


copy_files(non_music,dataset2_non_music,tocpy)
copy_files(music,dataset2_music,tocpy)
copy_files(test_music,test,100)
#move_files(dataset2_music,test_music,5000)
#move_files(dataset2_non_music,tes_non_music,5000)
#move_files(dataset2_music,valudation_music,10000)
#move_files(dataset2_non_music,valudation_non_music,10000)