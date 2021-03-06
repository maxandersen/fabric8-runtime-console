import {Component, Input} from "@angular/core";
import {ConfigMap} from "../../../model/configmap.model";

@Component({
  selector: 'fabric8-configmap-view-toolbar',
  templateUrl: './view-toolbar.configmap.html',
  styleUrls: ['./view-toolbar.configmap.scss'],
})
export class ConfigMapViewToolbarComponent {

  @Input() configmap: ConfigMap;

}
