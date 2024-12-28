// Configuration and Constants
const API_KEY = 'YOUR_API_KEY'; // Replace with your AlphaVantage API key
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Main class to handle stock operations
class StockTracker {
    constructor() {
        this.stocks = [];
        this.charts = {};
        this.loadStocks();
        this.setupEventListeners();
        this.updateDashboard();
        this.checkPriceAlerts();
    }

    loadStocks() {
        const savedStocks = localStorage.getItem('stocks');
        this.stocks = savedStocks ? JSON.parse(savedStocks) : [];
    }

    saveStocks() {
        localStorage.setItem('stocks', JSON.stringify(this.stocks));
    }

    async fetchStockData(ticker) {
        const cachedData = this.getCachedData(ticker);
        if (cachedData) return cachedData;

        try {
            const response = await fetch(
                `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`
            );
            const data = await response.json();
            
            if (data['Global Quote']) {
                const stockData = {
                    price: parseFloat(data['Global Quote']['05. price']),
                    change: parseFloat(data['Global Quote']['09. change']),
                    changePercent: parseFloat(data['Global Quote']['10. change percent'].replace('%', '')),
                    timestamp: new Date().getTime()
                };
                
                this.cacheData(ticker, stockData);
                return stockData;
            }
            throw new Error('Invalid API response');
        } catch (error) {
            console.error(`Error fetching data for ${ticker}:`, error);
            return null;
        }
    }

    cacheData(ticker, data) {
        localStorage.setItem(`stock_data_${ticker}`, JSON.stringify({
            data,
            timestamp: new Date().getTime()
        }));
    }

    getCachedData(ticker) {
        const cached = localStorage.getItem(`stock_data_${ticker}`);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        if (new Date().getTime() - timestamp > CACHE_DURATION) {
            localStorage.removeItem(`stock_data_${ticker}`);
            return null;
        }

        return data;
    }

    // Initialize charts
    initializeCharts() {
        const diversificationCtx = document.getElementById('diversification-chart').getContext('2d');
        this.charts.diversification = new Chart(diversificationCtx, {
            type: 'pie',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                        '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });

        const sectorCtx = document.getElementById('sector-chart').getContext('2d');
        this.charts.sector = new Chart(sectorCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                        '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    calculatePortfolioMetrics() {
        let totalValue = 0;
        let totalDailyChange = 0;
        let totalInitialValue = 0;

        this.stocks.forEach(stock => {
            const currentValue = stock.quantity * stock.currentPrice;
            const initialValue = stock.quantity * stock.purchasePrice;
            
            totalValue += currentValue;
            totalDailyChange += stock.quantity * stock.change;
            totalInitialValue += initialValue;
        });

        const totalGainLoss = totalValue - totalInitialValue;
        const totalGainLossPercent = ((totalGainLoss / totalInitialValue) * 100).toFixed(2);

        return {
            totalValue,
            totalDailyChange,
            totalGainLoss,
            totalGainLossPercent
        };
    }

    async updateDashboard() {
        if (!this.charts.diversification) {
            this.initializeCharts();
        }

        const stockPromises = this.stocks.map(async (stock, index) => {
            const data = await this.fetchStockData(stock.ticker);
            if (data) {
                this.stocks[index] = {
                    ...stock,
                    currentPrice: data.price,
                    change: data.change,
                    changePercent: data.changePercent
                };
            }
        });

        await Promise.all(stockPromises);
        this.saveStocks();

        const metrics = this.calculatePortfolioMetrics();
        document.getElementById('total-value').textContent = 
            `$${metrics.totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById('daily-change').textContent = 
            `$${metrics.totalDailyChange.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${((metrics.totalDailyChange/metrics.totalValue)*100).toFixed(2)}%)`;
        document.getElementById('total-gain-loss').textContent = 
            `$${metrics.totalGainLoss.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${metrics.totalGainLossPercent}%)`;
        document.getElementById('num-holdings').textContent = this.stocks.length;

        this.renderSt