export interface GetAllUserRes {
    uid:      number;
    email:    string;
    password: string;
    image:    null | string;
    type:     number;
    name:     string;
    Picture:  Picture[];
}

export interface Picture {
    mid:   number;
    path:  string;
    name:  string;
    uid:   number;
    score: number;
}

