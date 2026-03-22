#!/bin/bash
# 真实集成测试：验证 Content Filter Business Threshold
# 测试步骤：
# 1. 启动 Next.js 开发服务器
# 2. 调用 collection API 抓取真实论文
# 3. 检查 LLM 评估结果
# 4. 验证 Business < 3 的论文被拒绝

echo "🧪 真实集成测试：Content Filter Business Threshold"
echo "================================================"
echo ""
echo "⚠️  注意：这会消耗 Groq API tokens 并抓取真实论文"
echo ""

# 检查服务器是否在运行
echo "📡 检查服务器状态..."
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "❌ 服务器未运行！请先运行: npm run dev"
    echo ""
    echo "或者启动测试服务器:"
    echo "  终端1: npm run dev"
    echo "  终端2: ./test-real-filter.sh"
    exit 1
fi

echo "✅ 服务器运行中"
echo ""

# 测试1：查询 "AI in banking" (应该有很多高 business 分数)
echo "📊 测试1: AI in banking (预期：大部分接受)"
echo "------------------------------------------------"
curl -s -X POST http://localhost:3000/api/collection \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "auto",
    "query": "AI in banking",
    "maxResults": 10
  }' | jq '.results | .[] | {title: .title, relevanceScore: .relevanceScore, businessScore: .businessScore, isRelevant: .isRelevant}' 2>/dev/null || echo "等待结果..."

echo ""
echo ""

# 测试2：查询纯技术论文 (应该有很多低 business 分数被拒绝)
echo "📊 测试2: nlp to sql (预期：部分低 business 被拒绝)"
echo "-----------------------------------------------------"
curl -s -X POST http://localhost:3000/api/collection \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "pipeline",
    "query": "nlp to sql",
    "queryStrictness": "balanced",
    "maxResults": 10
  }' | jq '.results | .[] | {title: .title, relevanceScore: .relevanceScore, businessScore: .businessScore, isRelevant: .isRelevant}' 2>/dev/null || echo "等待结果..."

echo ""
echo ""

# 检查日志
echo "📋 检查最近日志中的过滤结果..."
echo "----------------------------------------------"
if [ -f logs/collection-$(date +%Y-%m-%d).log ]; then
    tail -50 logs/collection-$(date +%Y-%m-%d).log | grep -E "(Paper rejected|Paper details|businessScore)" | tail -20
else
    echo "日志文件不存在，检查控制台输出..."
fi

echo ""
echo "✅ 测试完成！"
echo ""
echo "验证要点："
echo "1. 检查被拒绝的论文是否有 businessScore <= 2"
echo "2. 检查被接受的论文是否有 businessScore > 2"
echo "3. 检查 relevanceScore 计算是否正确"
