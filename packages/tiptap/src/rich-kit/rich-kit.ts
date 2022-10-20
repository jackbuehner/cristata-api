import { AnyExtension, Extension } from '@tiptap/core';
import FontFamily, { FontFamilyOptions } from '@tiptap/extension-font-family';
import Link, { LinkOptions } from '@tiptap/extension-link';
import Table, { TableOptions } from '@tiptap/extension-table';
import TableCell, { TableCellOptions } from '@tiptap/extension-table-cell';
import TableHeader, { TableHeaderOptions } from '@tiptap/extension-table-header';
import TableRow, { TableRowOptions } from '@tiptap/extension-table-row';
import TextStyle, { TextStyleOptions } from '@tiptap/extension-text-style';
import Underline, { UnderlineOptions } from '@tiptap/extension-underline';
import StarterKit, { StarterKitOptions } from '@tiptap/starter-kit';
import { ClassName, ClassNameOptions } from '../extension-class-name';
import { Comment } from '../extension-comment';
import { FontSize, FontSizeOptions } from '../extension-font-size/font-size';
import { PhotoWidget, PhotoWidgetOptions } from '../extension-photo/PhotoWidget';
import { PowerComment } from '../extension-power-comment';
import { PullQuote, PullQuoteOptions } from '../extension-pull-quote/PullQuote';
import { TrackChanges, TrackChangesOptions } from '../extension-track-changes/trackChanges';
import { SweepwidgetWidget, SweepwidgetWidgetOptions } from '../extension-widget-sweepwidget/sweepwidgetWidget';
import { YoutubeWidget, YoutubeWidgetOptions } from '../extension-widget-youtube/youtubeWidget';

interface RichKitOptions extends StarterKitOptions {
  className: Partial<ClassNameOptions> | false;
  comment: false;
  fontFamily: Partial<FontFamilyOptions> | false;
  fontSize: Partial<FontSizeOptions> | false;
  link: Partial<LinkOptions> | false;
  photoWidget: Partial<PhotoWidgetOptions> | false;
  powerComment: false;
  pullQuote: Partial<PullQuoteOptions> | false;
  sweepwidgetWidget: Partial<SweepwidgetWidgetOptions> | false;
  table: Partial<TableOptions> | false;
  tableCell: Partial<TableCellOptions> | false;
  tableHeader: Partial<TableHeaderOptions> | false;
  tableRow: Partial<TableRowOptions> | false;
  trackChanges: Partial<TrackChangesOptions> | false;
  textStyle: Partial<TextStyleOptions> | false;
  underline: Partial<UnderlineOptions> | false;
  youtubeWidget: Partial<YoutubeWidgetOptions> | false;
}

const RichKit = Extension.create<RichKitOptions>({
  name: 'richKit',

  addExtensions() {
    const extensions: AnyExtension[] = [StarterKit];

    if (this.options.className !== false) {
      extensions.push(ClassName.configure({ types: ['heading', 'paragraph'], ...this.options?.className }));
    }

    if (this.options.comment !== false) {
      extensions.push(Comment);
    }

    if (this.options.fontFamily !== false) {
      extensions.push(FontFamily.configure(this.options?.fontFamily));
    }

    if (this.options.fontSize !== false) {
      extensions.push(FontSize.configure(this.options?.fontSize));
    }

    if (this.options.link !== false) {
      extensions.push(
        Link.configure({
          HTMLAttributes: {
            target: '_self',
            rel: 'noopener noreferrer nofollow',
          },
          openOnClick: false,
          linkOnPaste: true,
          ...this.options?.link,
        })
      );
    }

    if (this.options.photoWidget !== false) {
      extensions.push(PhotoWidget.configure(this.options?.photoWidget));
    }

    if (this.options.powerComment !== false) {
      extensions.push(PowerComment);
    }

    if (this.options.pullQuote !== false) {
      extensions.push(PullQuote.configure(this.options?.pullQuote));
    }

    if (this.options.sweepwidgetWidget !== false) {
      extensions.push(SweepwidgetWidget.configure(this.options?.sweepwidgetWidget));
    }

    if (this.options.table !== false) {
      extensions.push(Table.configure(this.options?.table));
    }

    if (this.options.tableCell !== false) {
      extensions.push(TableCell.configure(this.options?.tableCell));
    }

    if (this.options.tableHeader !== false) {
      extensions.push(TableHeader.configure(this.options?.tableHeader));
    }

    if (this.options.tableRow !== false) {
      extensions.push(TableRow.configure(this.options?.tableRow));
    }

    if (this.options.trackChanges !== false) {
      extensions.push(TrackChanges.configure(this.options?.trackChanges));
    }

    if (this.options.textStyle !== false) {
      extensions.push(TextStyle.configure(this.options?.textStyle));
    }

    if (this.options.underline !== false) {
      extensions.push(Underline.configure(this.options?.underline));
    }

    if (this.options.youtubeWidget !== false) {
      extensions.push(YoutubeWidget.configure(this.options?.youtubeWidget));
    }

    return extensions;
  },
});

export { RichKit };
export type { RichKitOptions };
