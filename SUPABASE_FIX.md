# Supabase updated_at 自動更新の設定

## 問題
`updated_at`が更新されない

## 解決方法

Supabaseダッシュボードで以下のSQLを実行してください：

### 1. updated_atカラムの確認
```sql
-- issues テーブルの構造を確認
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'issues';
```

### 2. updated_atが存在しない場合は追加
```sql
-- updated_at カラムを追加（存在しない場合）
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

### 3. 自動更新トリガーを作成
```sql
-- トリガー関数を作成
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガーを作成
DROP TRIGGER IF EXISTS update_issues_updated_at ON issues;
CREATE TRIGGER update_issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## 確認方法

1. Supabaseダッシュボード → SQL Editor
2. 上記SQLを実行
3. アプリで項目を編集して保存
4. 詳細画面で更新日時が変わっていることを確認
