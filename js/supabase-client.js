// Supabase設定
const SUPABASE_URL = 'https://ujagpluxraulkffnlzqh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqYWdwbHV4cmF1bGtmZm5senFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDI5MjAsImV4cCI6MjA3OTg3ODkyMH0.f4IN2wwE0UuAVcmZ0En2tLJJ6cC7MAlPvnlnMqWYWHo';

// Supabase REST APIヘルパー関数
const SupabaseAPI = {
    // 全件取得
    async getAll() {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/issues?select=*&order=created_at.desc`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    },
    
    // ID指定で取得
    async getById(id) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/issues?id=eq.${id}&select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data[0];
    },
    
    // 新規作成
    async create(data) {
        console.log('🔵 Supabase作成開始:', data);
        console.log('🔵 URL:', `${SUPABASE_URL}/rest/v1/issues`);
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/issues`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
        
        console.log('🔵 レスポンスステータス:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 作成エラー - ステータス:', response.status);
            console.error('❌ エラー詳細:', errorText);
            throw new Error(`保存に失敗しました (${response.status})`);
        }
        
        const result = await response.json();
        console.log('✅ 作成成功:', result);
        return result[0];
    },
    
    // 更新
    async update(id, data) {
        console.log('🟡 Supabase更新開始 ID:', id, 'データ:', data);
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/issues?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
        
        console.log('🟡 更新レスポンスステータス:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 更新エラー - ステータス:', response.status);
            console.error('❌ エラー詳細:', errorText);
            throw new Error(`更新に失敗しました (${response.status})`);
        }
        
        const result = await response.json();
        console.log('✅ 更新成功:', result);
        return result[0];
    },
    
    // 削除
    async delete(id) {
        console.log('🔴 Supabase削除開始 ID:', id);
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/issues?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        console.log('🔴 削除レスポンスステータス:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 削除エラー - ステータス:', response.status);
            console.error('❌ エラー詳細:', errorText);
            throw new Error(`削除に失敗しました (${response.status})`);
        }
        
        console.log('✅ 削除成功');
        return true;
    }
};
