# comic-Flame AIコンテJSON仕様 v1.0

目的：kibiが作成したコマ割りコンテを、comic-Flameでそのまま読み込み、Kimが画面上で修正できるようにする。

## 基本形

```json
{
  "title": "P2 コマ割り案",
  "source": "kibi-storyboard",
  "paper": {
    "size": "B5",
    "orientation": "portrait",
    "spreadMode": "single",
    "safeMargin": 12,
    "bleed": 3
  },
  "panels": []
}
```

単位はすべて mm。

## 四角コマ

```json
{
  "name": "P1",
  "x": 12,
  "y": 12,
  "w": 158,
  "h": 45
}
```

- x：左端
- y：上端
- w：幅
- h：高さ

## 斜め・台形・自由四角形

```json
{
  "name": "P2",
  "points": [
    { "x": 12, "y": 62 },
    { "x": 170, "y": 58 },
    { "x": 170, "y": 125 },
    { "x": 12, "y": 130 }
  ]
}
```

points は外周を順番に4点以上指定する。

## kibi出力ルール

1. B5縦を基本とする。
2. 日本式右綴じを前提に配置する。
3. 横並びは右→左の読み順にする。
4. コマ番号自体はcomic-Flame v0.4以降が配置から自動判定する。
5. 通常四角コマは x/y/w/h を優先する。
6. 斜め・台形・変則枠は points を使用する。
7. 数値は0.1mm単位まで使用可能。
8. JSON以外の説明文を混ぜないことを基本とする。コードフェンス付きJSONもv0.5では読み込み可能。

## 完成例

```json
{
  "title": "第0話 P2",
  "source": "kibi-storyboard",
  "paper": {
    "size": "B5",
    "orientation": "portrait",
    "spreadMode": "single",
    "safeMargin": 12,
    "bleed": 3
  },
  "panels": [
    {
      "name": "P1",
      "x": 12,
      "y": 12,
      "w": 158,
      "h": 45
    },
    {
      "name": "P2",
      "points": [
        { "x": 92, "y": 62 },
        { "x": 170, "y": 60 },
        { "x": 170, "y": 130 },
        { "x": 88, "y": 128 }
      ]
    },
    {
      "name": "P3",
      "x": 12,
      "y": 62,
      "w": 72,
      "h": 66
    }
  ]
}
```

このJSONを comic-Flame v0.5 の「AIコンテ読込」に貼り付け、「コンテJSONを反映」を押す。
