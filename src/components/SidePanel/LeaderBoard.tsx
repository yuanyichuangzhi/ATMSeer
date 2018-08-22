import * as React from 'react';
import { Collapse, Tag, Progress } from 'antd';
import { IDatarunStatusTypes } from 'types/index';
import { getClassifiers, IClassifierInfo, IDatarunInfo, getDatarun, IHyperpartitionInfo, getHyperpartitions } from 'service/dataService';
// import {getDatarunStepsScores } from 'service/dataService';
import { UPDATE_INTERVAL_MS } from 'Const';
import './LeaderBoard.css';
// import LineChart from './LineChart';
import { getColor } from 'helper';

const Panel = Collapse.Panel;

const TOP_K = 10;

function isFloat(n: number): boolean {
    return n % 1 !== 0;
}

export interface IDatarunSummary {
    nTried: number;
    topClassifiers: IClassifierInfo[];
    nTriedByMethod: { [method: string]: number };
}

export function computeDatarunSummary(classifiers: IClassifierInfo[]): IDatarunSummary {
    // This need to fix to support other metric?
    classifiers = [...classifiers];
    classifiers.sort((a, b) => -a.cv_metric + b.cv_metric);
    const nTriedByMethod = {};
    classifiers.forEach(c => {
        const nTried = nTriedByMethod[c.method];
        nTriedByMethod[c.method] = nTried ? nTried + 1 : 1;
    });
    return {
        nTried: classifiers.length,
        topClassifiers: classifiers.slice(0, TOP_K),
        nTriedByMethod
    };
}

export function classifierMetricString(c: IClassifierInfo): string {
    return `${c.cv_metric.toFixed(3)} ± ${c.cv_metric_std.toFixed(3)}`;
}

export function HyperParams(params: { [method: string]: any }) {
    const keys = Object.keys(params);
    keys.sort();
    return (
        <React.Fragment>
            {keys.map(k => (
                <span key={k}>
                    <b>{k}</b>: {typeof params[k] === 'number'
                    ? (isFloat(params[k]) ? params[k].toPrecision(4) : params[k] )
                    : String(params[k])}
                <br/>
                </span>

            ))}
        </React.Fragment>
    );
}

export function MethodHeader(params: IClassifierInfo) {
    const width = `${(params.cv_metric * 70).toFixed(1)}%`;
    return (
        <div>
            <Tag color={getColor(params.method)}>{params.method}</Tag>
            {/* <div> */}
            <div className="lb-classifier" style={{ width }}>none</div>
            <span className="lb-classifier-metric">{classifierMetricString(params)}</span>
            {/* </div> */}
        </div>
    );
}

export interface LeaderBoardProps {
    datarunID: number | null;
    datarunStatus: IDatarunStatusTypes;
}

export interface LeaderBoardState {
    datarunInfo: IDatarunInfo | null;
    hyperpartitions: IHyperpartitionInfo[];
    summary: IDatarunSummary | null;
    // scores: {[id: string]: number}[];
}

export default class LeaderBoard extends React.Component<LeaderBoardProps, LeaderBoardState> {
    private intervalID: number;
    constructor(props: LeaderBoardProps) {
        super(props);
        this.updateLeaderBoard = this.updateLeaderBoard.bind(this);
        this.state = {
            summary: null,
            datarunInfo: null,
            hyperpartitions: [],
            // scores: [],
        };
    }
    public updateLeaderBoard(updateDatarunInfo: boolean = false) {
        const { datarunID } = this.props;
        if (datarunID === null) return;
        getClassifiers(datarunID).then(classifiers => {
            // console.log(classifiers);
            this.setState({ summary: computeDatarunSummary(classifiers) });
        });
        // getDatarunStepsScores(datarunID).then(scores => this.setState({scores}))
        if (updateDatarunInfo) {
            getDatarun(datarunID).then(datarunInfo => this.setState({ datarunInfo }));
            getHyperpartitions().then(hyperpartitions => {
                if (Array.isArray(hyperpartitions))
                   {
                       hyperpartitions=hyperpartitions.filter(d=>d.datarun_id==datarunID)
                       this.setState({ hyperpartitions });
                   }
                else
                    console.error('The fetched hyperpartitions should be an array!');
            });
        }
    }
    public startOrStopUpdateCycle() {
        if (this.props.datarunStatus === IDatarunStatusTypes.RUNNING) {
            this.intervalID = window.setInterval(this.updateLeaderBoard, UPDATE_INTERVAL_MS);
        } else {
            clearInterval(this.intervalID);
        }
    }
    componentDidMount() {
        this.updateLeaderBoard(true);
        this.startOrStopUpdateCycle();
    }
    componentDidUpdate(prevProps: LeaderBoardProps) {
        if (prevProps.datarunID !== this.props.datarunID) {
            this.updateLeaderBoard(true);
        }
        if (prevProps.datarunStatus !== this.props.datarunStatus) {
            this.startOrStopUpdateCycle();
        }
    }
    public componentWillUnmount() {
        window.clearInterval(this.intervalID)
    }
    public render() {

        const { summary, datarunInfo, hyperpartitions} = this.state
        // const {scores, hyperpartitions } = this.state;
        console.info(hyperpartitions, new Set(hyperpartitions.map(d=>d.method)))
        const methods = Array.from(new Set(hyperpartitions.map(d=>d.method)))
        const best = summary ? summary.topClassifiers[0] : undefined;
        const progressAlgorithm = (percent:number)=>{
            return `${methods.length}/14`
        }
        const progressHyperpartiton = (percent:number)=>{
            return `${hyperpartitions.length}/172`
        }
        return summary ? (
            <div >
                <div>
                    {/* <h4>Overview</h4> */}
                    {/* <hr /> */}
                    <div>
                        <b>Metric</b>: {datarunInfo && datarunInfo.metric}
                        <br/>
                        <b>Best classifier</b>:
                        <span
                            style={{
                                backgroundColor: getColor(best?best.method:''),
                                borderRadius:'4px',
                                padding:'2px',
                                marginLeft: "2px",
                                color: 'white'
                            }}
                            >
                            {best && `${best.method}-${best.id}`}
                        </span>
                        <br/>
                        <b>Total classifiers</b>: {summary.nTried}
                        <br/>
                        <b>Algorithm Coverage</b>:{' '}
                        <Progress
                        type="circle"
                        percent={100*methods.length/14}
                        format={progressAlgorithm}
                        width={40}
                        strokeWidth={10}
                        />
                        <br/>
                        <b>Hyperpartitions Coverage</b>:{' '}
                        <Progress
                        type="circle"
                        percent={100*hyperpartitions.length/172}
                        format={progressHyperpartiton}
                        width={40}
                        strokeWidth={10}
                        />


                    </div>
                    {/* <div>
                        <LineChart scores={scores} hyperpartitions={hyperpartitions} topK={TOP_K}/>
                    </div> */}
                </div>
                <div>
                    {/* <h4>Scores</h4> */}
                    <h4>Top {TOP_K} Classifiers</h4>
                    <hr />
                    <div style={{height:"calc(94vh - 410px)", overflowY:"scroll"}}>
                    <Collapse bordered={false}>
                        {summary.topClassifiers.map(c => (
                            <Panel key={String(c.id)} header={<MethodHeader {...c} />}>
                                <HyperParams {...c.hyperparameters} />
                            </Panel>
                        ))}
                    </Collapse>
                    </div>
                </div>
            </div>
        ) : (
            <div>Please select a datarun.</div>
        );
    }
}
