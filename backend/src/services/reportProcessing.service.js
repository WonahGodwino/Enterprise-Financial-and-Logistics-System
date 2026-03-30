import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth'; // For Word documents
import xlsx from 'xlsx'; // For Excel files
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import natural from 'natural'; // For NLP
import { AppError } from '../utils/AppError.js';
import prisma from '../config/database.js';

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

export class ReportProcessingService {
  
  /**
   * Process uploaded report file
   */
  async processReport(file, userId, weekStartDate, weekEndDate) {
    try {
      // Extract text based on file type
      let extractedText = '';
      let structuredData = {};

      const fileExt = path.extname(file.originalname).toLowerCase();

      switch (fileExt) {
        case '.docx':
        case '.doc':
          extractedText = await this.processWordFile(file.path);
          structuredData = await this.analyzeTextContent(extractedText);
          break;
        case '.xlsx':
        case '.xls':
          structuredData = await this.processExcelFile(file.path);
          extractedText = JSON.stringify(structuredData);
          break;
        case '.csv':
          structuredData = await this.processCSVFile(file.path);
          extractedText = JSON.stringify(structuredData);
          break;
        default:
          throw new AppError('Unsupported file format', 400);
      }

      // Get user's job description and KPIs
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { jobDescription: true }
      });

      if (!user || !user.jobDescription) {
        throw new AppError('User or job description not found', 404);
      }

      // Analyze against KPIs
      const kpiAnalysis = await this.analyzeAgainstKPIs(
        structuredData, 
        user.jobDescription.kpis,
        extractedText
      );

      // Calculate performance score
      const performanceScore = this.calculatePerformanceScore(kpiAnalysis);
      
      // Determine rating and color code
      const { rating, colorCode } = this.getPerformanceRating(performanceScore);

      // Store analysis results
      const analysis = {
        kpiAnalysis,
        textAnalysis: await this.performTextAnalysis(extractedText, user.jobDescription),
        extractedTasks: structuredData.tasks || [],
        extractedMetrics: structuredData.metrics || {},
        keywords: this.extractKeywords(extractedText),
        sentiment: this.analyzeSentiment(extractedText)
      };

      return {
        extractedData: structuredData,
        kpiAnalysis,
        performanceScore,
        performanceRating: rating,
        colorCode,
        analysis
      };

    } catch (error) {
      console.error('Error processing report:', error);
      throw new AppError('Failed to process report: ' + error.message, 500);
    } finally {
      // Clean up uploaded file
      try {
        await fs.unlink(file.path);
      } catch (err) {
        console.error('Error deleting temp file:', err);
      }
    }
  }

  /**
   * Process Word document
   */
  async processWordFile(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      throw new Error('Failed to process Word document: ' + error.message);
    }
  }

  /**
   * Process Excel file
   */
  async processExcelFile(filePath) {
    try {
      const workbook = xlsx.readFile(filePath);
      const structuredData = {
        sheets: {},
        tasks: [],
        metrics: {}
      };

      // Process each sheet
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(sheet);
        structuredData.sheets[sheetName] = jsonData;

        // Try to identify tasks and metrics
        if (sheetName.toLowerCase().includes('task')) {
          structuredData.tasks = jsonData;
        }
        if (sheetName.toLowerCase().includes('metric')) {
          structuredData.metrics = jsonData;
        }
      });

      return structuredData;
    } catch (error) {
      throw new Error('Failed to process Excel file: ' + error.message);
    }
  }

  /**
   * Process CSV file
   */
  async processCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          resolve({
            data: results,
            tasks: results.filter(r => r.type === 'task' || r.category === 'task'),
            metrics: results.reduce((acc, row) => {
              if (row.metric && row.value) {
                acc[row.metric] = parseFloat(row.value) || row.value;
              }
              return acc;
            }, {})
          });
        })
        .on('error', reject);
    });
  }

  /**
   * Analyze text content using NLP
   */
  async analyzeTextContent(text) {
    const sentences = text.split(/[.!?]+/);
    const tasks = [];
    const metrics = {};

    // Look for task-like sentences
    sentences.forEach(sentence => {
      const lower = sentence.toLowerCase();
      if (lower.includes('completed') || lower.includes('finished') || 
          lower.includes('done') || lower.includes('achieved')) {
        tasks.push({
          description: sentence.trim(),
          completed: true,
          confidence: 0.8
        });
      } else if (lower.includes('working on') || lower.includes('in progress')) {
        tasks.push({
          description: sentence.trim(),
          completed: false,
          confidence: 0.7
        });
      }

      // Look for metrics (numbers with units)
      const metricMatches = sentence.match(/(\d+[.,]?\d*)\s*(%|hours|days|units|₦|\$|euro)/gi);
      if (metricMatches) {
        metricMatches.forEach(match => {
          const [value, unit] = match.split(/\s+/);
          metrics[`metric_${Date.now()}`] = {
            value: parseFloat(value),
            unit,
            description: sentence.trim()
          };
        });
      }
    });

    return { tasks, metrics, fullText: text };
  }

  /**
   * Analyze against KPIs
   */
  async analyzeAgainstKPIs(reportData, kpis, extractedText) {
    const analysis = [];

    if (!kpis || !Array.isArray(kpis)) {
      return analysis;
    }

    for (const kpi of kpis) {
      let achieved = 0;
      let percentage = 0;
      let status = 'not_measured';
      let color = 'gray';

      // Try to extract KPI value from report
      const value = this.extractKpiValue(reportData, kpi, extractedText);

      if (value !== null) {
        achieved = value;
        percentage = (achieved / kpi.target) * 100;
        
        // Determine status and color
        if (percentage >= 90) {
          status = 'excellent';
          color = 'green';
        } else if (percentage >= 75) {
          status = 'good';
          color = 'yellow';
        } else if (percentage >= 60) {
          status = 'average';
          color = 'orange';
        } else {
          status = 'poor';
          color = 'red';
        }
      }

      analysis.push({
        kpiId: kpi.id,
        kpiName: kpi.name,
        target: kpi.target,
        achieved,
        percentage: percentage.toFixed(2),
        variance: achieved - kpi.target,
        weight: kpi.weight || 1,
        status,
        color,
        measurement: kpi.measurement || 'weekly'
      });
    }

    return analysis;
  }

  /**
   * Extract KPI value from report data
   */
  extractKpiValue(reportData, kpi, extractedText) {
    // Try to find in structured data
    if (reportData.metrics) {
      // Look for matching metric name
      for (const [key, value] of Object.entries(reportData.metrics)) {
        if (key.toLowerCase().includes(kpi.name.toLowerCase())) {
          return typeof value === 'number' ? value : parseFloat(value) || null;
        }
      }
    }

    // Try to find in tasks
    if (reportData.tasks) {
      const relevantTasks = reportData.tasks.filter(task => 
        task.description?.toLowerCase().includes(kpi.name.toLowerCase())
      );
      if (relevantTasks.length > 0) {
        // Could sum up task values or count
        return relevantTasks.length;
      }
    }

    // Try to find in text using regex
    if (extractedText) {
      const patterns = [
        new RegExp(`${kpi.name}[:\\s]*(\\d+[.,]?\\d*)`, 'i'),
        new RegExp(`(\\d+[.,]?\\d*)\\s*${kpi.unit}`, 'i'),
        new RegExp(`total\\s*${kpi.name}[:\\s]*(\\d+[.,]?\\d*)`, 'i')
      ];

      for (const pattern of patterns) {
        const match = extractedText.match(pattern);
        if (match) {
          return parseFloat(match[1].replace(',', ''));
        }
      }
    }

    return null;
  }

  /**
   * Calculate performance score from KPI analysis
   */
  calculatePerformanceScore(kpiAnalysis) {
    if (!kpiAnalysis.length) return 0;

    let totalWeight = 0;
    let weightedScore = 0;

    kpiAnalysis.forEach(kpi => {
      const weight = kpi.weight || 1;
      totalWeight += weight;
      
      // Calculate score based on percentage
      let score = 0;
      if (kpi.percentage >= 90) score = 100;
      else if (kpi.percentage >= 75) score = 85;
      else if (kpi.percentage >= 60) score = 70;
      else if (kpi.percentage >= 40) score = 50;
      else score = 30;

      weightedScore += score * weight;
    });

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Get performance rating and color code
   */
  getPerformanceRating(score) {
    if (score >= 90) {
      return { rating: 'EXCELLENT', colorCode: 'green' };
    } else if (score >= 75) {
      return { rating: 'GOOD', colorCode: 'yellow' };
    } else if (score >= 60) {
      return { rating: 'AVERAGE', colorCode: 'orange' };
    } else if (score >= 40) {
      return { rating: 'POOR', colorCode: 'red' };
    } else {
      return { rating: 'CRITICAL', colorCode: 'red' };
    }
  }

  /**
   * Perform advanced text analysis
   */
  async performTextAnalysis(text, jobDescription) {
    const tfidf = new TfIdf();
    tfidf.addDocument(text);

    // Extract keywords
    const keywords = [];
    tfidf.listTerms(0).forEach(item => {
      keywords.push({
        term: item.term,
        tfidf: item.tfidf
      });
    });

    // Compare with job description keywords
    const jobKeywords = this.extractKeywords(JSON.stringify(jobDescription));
    
    // Calculate relevance score
    const relevanceScore = this.calculateRelevance(keywords, jobKeywords);

    return {
      keywords: keywords.slice(0, 20),
      relevanceScore,
      wordCount: text.split(/\s+/).length,
      sentenceCount: text.split(/[.!?]+/).length
    };
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text) {
    const tokens = tokenizer.tokenize(text.toLowerCase());
    const stopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                       'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through'];
    
    const words = tokens.filter(token => 
      token.length > 3 && !stopwords.includes(token)
    );

    // Count frequencies
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }

  /**
   * Analyze sentiment of text
   */
  analyzeSentiment(text) {
    const positiveWords = ['achieved', 'completed', 'successful', 'excellent', 'good', 
                          'great', 'improved', 'increased', 'grew', 'positive'];
    const negativeWords = ['failed', 'missed', 'poor', 'bad', 'decreased', 'declined',
                          'negative', 'issue', 'problem', 'delay', 'late'];

    const words = text.toLowerCase().split(/\s+/);
    
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });

    const total = positiveCount + negativeCount;
    const score = total > 0 ? (positiveCount - negativeCount) / total : 0;

    return {
      score,
      sentiment: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
      positiveCount,
      negativeCount
    };
  }

  /**
   * Calculate relevance between report and job description
   */
  calculateRelevance(reportKeywords, jobKeywords) {
    const jobWordSet = new Set(jobKeywords.map(k => k.word));
    const reportWordSet = new Set(reportKeywords.map(k => k.term));

    const intersection = new Set(
      [...reportWordSet].filter(word => jobWordSet.has(word))
    );

    const union = new Set([...reportWordSet, ...jobWordSet]);
    
    return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
  }
}