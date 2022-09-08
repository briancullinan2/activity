var D3Node = require('d3-node');
var moment = require('moment');
var d3n = new D3Node();
var d3 = d3n.d3;

function d3Heatmap(data) {
    var margin = {top: 20, right: 50, bottom: 20, left: 20};

    // input vars for getter setters
    // TODO: turn these in to options
    var startYear = d3.min(data.map(d => d.start)).getFullYear(),
        endYear = d3.max(data.map(d => d.end)).getFullYear() + 1,
        years = d3.range(startYear, endYear).reverse(),
        colourRangeStart = '#2222FF',
        colourRangeEnd = '#222266',
        width = 950,
        height = years.length * 150,
        dayLength = 60 * 60 * 24,
        sizeByYear = (height - margin.top - margin.bottom) / years.length,
        sizeByDay = d3.min([
            // divide by 8, 7 days in a week and 1 row for label
            sizeByYear / 8,
            // 54 weeks because every year has a partial week on both ends
            (width - margin.left - margin.right) / 54]),
        day = (d) => (d.getDay() + 6) % 7,
        week = d3.timeFormat('%W'),
        date = d3.timeFormat('%b %d');

    // combine date data by day
    var nestedData = d3.nest()
        // round down to nearest day
        .key((d) => Math.round(d.start.getTime() / dayLength / 1000) * dayLength)
        // sum hours spent for the day to determine color range
        .rollup(function (n) { 
            return d3.sum(n, function (d) { 
                return d.end.getTime() - d.start.getTime(); // key
            }); 
        })
        .map(data)
    
    var svg = d3n.createSVG(width, height)
        .attr('class', 'chart')
        .append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var year = svg.selectAll('.year')
        .data(years)
        .enter().append('g')
            .attr('class', 'year')
            .attr('font-size', 'smaller')
            .attr('transform', (d, i) => 'translate(30,' + i * sizeByYear + ')');

    year.append('text')
        .text((d) => d)
        .attr('class', 'year-title')
        .attr('transform', 'translate(-38,' + sizeByDay * 3.5 + ')rotate(-90)')
        .attr('text-anchor', 'middle')

    // apply the heatmap colours
    var colour = d3.scaleLinear()
        .range(['transparent', 'transparent', colourRangeStart, colourRangeEnd])
        .domain([-1, 0, .000001, 1])

    var rect = year.selectAll('.day')
        .data((d) => d3.timeDays(new Date(d, 0, 1), new Date(d + 1, 0, 1)))
        .enter().append('rect')
            .attr('fill', (d) => {
                const t = Math.round(d.getTime() / dayLength / 1000) * dayLength;
                // 12 hours of work is too much!
                const normalDay = nestedData['$'+t] / 1000 / (dayLength / 2);
                return isNaN(normalDay) ? 'transparent' : colour(normalDay);
            })
            .attr('class', 'day')
            .attr('stroke', 'black')
            .attr('stroke-width', .5)
            .attr('width', sizeByDay)
            .attr('height', sizeByDay)
            .attr('x', (d) => week(d) * sizeByDay)
            .attr('y', (d) => day(d) * sizeByDay);

    year.selectAll('.month')
        .data(d => d3.timeMonths(new Date(d, 0, 1), new Date(d + 1, 0, 1)))
        .enter().append('path')
            .attr('stroke', 'black')
            .attr('stroke-width', 2)
            .attr('class', 'month')
            .attr('fill', 'none')
            .attr('d', monthPath);

    // day and week titles
    var weekDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    var titlesDays = svg.selectAll('.year')
        .selectAll('.titles-day')
        .data(weekDays)
        .enter().append('g')
        .attr('class', 'titles-day')
        .attr('transform', (d, i) => 'translate(-5,' + sizeByDay*(i+1) + ')');

    titlesDays.append('text')
        .attr('class', (d, i) => weekDays[i])
        .style('text-anchor', 'end')
        .attr('dy', '-.25em')
        .text((d, i) => weekDays[i]); 

    var titlesMonth = svg.selectAll('.year')
        .selectAll('.titles-month')
            .data(month)
        .enter().append('g')
            .attr('class', 'titles-month')
            .attr('transform', (d, i) => 'translate(' + ((i+1) * (sizeByDay * 52) / 12 - sizeByDay) + ',-5)');

    titlesMonth.append('text')
        .attr('class', (d, i) => month[i])
        .style('text-anchor', 'end')
        .text((d,i) => month[i]);

    // thick line around each month, with a turn in between week
    function monthPath(t0) {
        var t1 = new Date(t0.getFullYear(), t0.getMonth() + 1, 0),
            d0 = +day(t0), w0 = +week(t0),
            d1 = +day(t1), w1 = +week(t1);

        return 'M' + (w0 + 1) * sizeByDay + ',' + d0 * sizeByDay
            + 'H' + w0 * sizeByDay + 'V' + 7 * sizeByDay 
            + 'H' + w1 * sizeByDay + 'V' + (d1 + 1) * sizeByDay
            + 'H' + (w1 + 1) * sizeByDay + 'V' + 0
            + 'H' + (w0 + 1) * sizeByDay + 'Z';
    }

    return d3n.svgString();
}

module.exports = d3Heatmap;
