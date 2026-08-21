# Bundled font

`DejaVuSans.ttf` is what the share-card renderer falls back to when the Inter
fetch from Google Fonts fails or is slow. Satori cannot render without font
bytes, so shipping one guarantees `/og.png` always returns an image.

DejaVu Sans is released under the Bitstream Vera and Arev Fonts licences, both
permissive and both allowing redistribution:
<https://dejavu-fonts.github.io/License.html>
