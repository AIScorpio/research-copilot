// 直接测试 content-filter 模块（真实 LLM 调用）
import { checkContentRelevance } from './src/lib/content-filter.js';

console.log('🧪 真实 LLM 测试：Content Filter Business Threshold\n');

const testCases = [
    {
        name: '❌ EHR Medical (应该被拒绝)',
        title: 'Deployment and Evaluation of an EHR-integrated, Large Language Model-Powered Tool to Triage Surgical Patients',
        abstract: 'Medical healthcare paper about surgical patient triage using LLMs'
    },
    {
        name: '❌ Interior Design (应该被拒绝)',
        title: 'Intelligent Co-Design: An Interactive LLM Framework for Interior Spatial Design',
        abstract: 'LLM framework for architectural interior design with no banking context'
    },
    {
        name: '✅ Financial Risk (应该被接受)',
        title: 'An Optimised Greedy-Weighted Ensemble Framework for Financial Loan Default Prediction',
        abstract: 'Paper explicitly targets loan default prediction, a core banking credit-risk problem'
    }
];

for (const test of testCases) {
    console.log(`\n📄 ${test.name}`);
    console.log(`   Title: ${test.title.substring(0, 60)}...`);
    
    try {
        const result = await checkContentRelevance(test.title, test.abstract);
        
        console.log(`   ✅ LLM 评估结果:`);
        console.log(`      isRelevant: ${result.isRelevant}`);
        console.log(`      relevanceScore: ${result.relevanceScore?.toFixed(2)}`);
        console.log(`      businessScore: ${result.dimensionScores?.business}`);
        console.log(`      technicalScore: ${result.dimensionScores?.technical}`);
        
        // 验证逻辑
        const expected = test.name.includes('❌') ? false : true;
        const passed = result.isRelevant === expected;
        console.log(`      ${passed ? '✅ 通过' : '❌ 失败'} - 预期: ${expected ? '接受' : '拒绝'}`);
        
    } catch (error) {
        console.log(`   ❌ 错误: ${error.message}`);
    }
}

console.log('\n✅ 测试完成！');
