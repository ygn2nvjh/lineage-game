from PIL import Image
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1];dest=root/'assets/portraits'
for sex in ['male','female']:
 im=Image.open(dest/'sources'/f'{sex}.png').convert('RGBA');box=im.getchannel('A').point(lambda x:255 if x>24 else 0).getbbox();im=im.crop(box);im.thumbnail((576,896),Image.Resampling.LANCZOS);im.save(dest/f'{sex}.webp',quality=90,method=6)
 print(sex,im.size)
