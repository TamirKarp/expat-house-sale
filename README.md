# Expat House Sale

Static site for expathousesale.com. No frameworks, no dependencies. To preview it, double-click `index.html`.

## Update the items

Put photos in one folder, then run:

```bash
node build.js "/path/to/your/photos"
```

- Photos in the folder show as for sale. Photos in a sub-folder called `sold` show as sold.
- The file name is the item name: `03-oak-dining-table.jpg` shows as "Oak dining table".
- Items run in file name order down the columns, so start names with `01-`, `02-` to control it.
- Several photos of one item: put the view in brackets, like `oak-table (front).jpg` and `oak-table (side).jpg`. They share one tile and one pop-up, with the views labelled Front and Side.
- To mark something sold, move its photo into the `sold` folder and run the command again.

The command shrinks the photos into `images/`, gives them a light touch-up (brightness, contrast, gentle sharpening, camera data removed) and rewrites `items.js`. Your originals are never changed. Upload the whole folder to publish.

## Contact details

Set your email and WhatsApp number in `config.js`.
